import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url);
require('ts-node').register({project:fileURLToPath(new URL('../tsconfig.json',import.meta.url)),transpileOnly:true});
const {PrismaPg}=require('@prisma/adapter-pg');
const {PrismaClient}=require('@prisma/client');
const {Client}=require('pg');

const {LodgeCommissionFinanceService}=require('../src/modules/lodges/commission-finance.service.ts');
const {CommissionPaymentService}=require('../src/modules/lodges/commission-payment.service.ts');
const {LodgeAccessService}=require('../src/modules/lodges/lodge-access.service.ts');
const {OwnerFinanceController}=require('../src/modules/lodges/owner-finance.controller.ts');
const {OwnerFinanceService}=require('../src/modules/lodges/owner-finance.service.ts');

test('PostgreSQL owner revenue, commission, partial payment, receipt and admin reconciliation lifecycle',
  {skip:!process.env.TEST_DATABASE_URL,timeout:120000},async(t)=>{
    const base=new URL(process.env.TEST_DATABASE_URL);
    assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Only disposable localhost databases are permitted');
    assert.match(base.pathname,/^\/tuljai_test_[a-zA-Z0-9_]+$/);
    const admin=new Client({connectionString:base.href});await admin.connect();
    const name=`tuljai_test_finance_${randomUUID().replaceAll('-','')}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url=new URL(base);url.pathname=`/${name}`;
    const sql=new Client({connectionString:url.href});await sql.connect();
    const db=new PrismaClient({adapter:new PrismaPg({connectionString:url.href})});
    try{
      const root=new URL('../prisma/migrations/',import.meta.url);
      for(const entry of readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
        // Match the existing booking/refund fixtures' historical bootstrap compatibility.
        if(entry.name==='20260821123000_add_review_owner_responses')continue;
        if(entry.name==='20260819090000_sync_online_payment_setting')await sql.query("INSERT INTO system_settings(id,key,value,updated_at) VALUES(gen_random_uuid(),'enable_online_payments','false'::jsonb,now())");
        await sql.query(readFileSync(new URL(`${entry.name}/migration.sql`,root),'utf8'));
      }
      const owner=await db.user.create({data:{displayName:'Finance test owner',roles:['OWNER']}});
      const guest=await db.user.create({data:{displayName:'Synthetic guest'}});
      const stranger=await db.user.create({data:{roles:['OWNER']}});
      const city=await db.city.create({data:{name:'Finance test city',slug:randomUUID(),state:'MH',country:'IN'}});
      const lodge=await db.lodge.create({data:{name:'Finance test lodge',slug:randomUUID(),cityId:city.id,ownerUserId:owner.id,propertyType:'LODGE',primaryPhone:'+919999999999',status:'VERIFIED',verificationStatus:'VERIFIED'}});
      await db.lodgeOwner.create({data:{lodgeId:lodge.id,userId:owner.id,ownerName:'Finance test owner',ownerPhone:'+919999999999',isPrimary:true}});
      const roomType=await db.roomType.create({data:{lodgeId:lodge.id,name:'Test room',slug:randomUUID(),basePrice:4500,capacityAdults:2,capacityChildren:0,totalRooms:3}});
      await sql.query("INSERT INTO lodge_commission_settings(lodge_id,commission_rate_percent,effective_from) VALUES($1,15,now()-interval '1 day')",[lodge.id]);
      async function booking(amount,status,paymentStatus,createdAt){return db.booking.create({data:{bookingCode:`FIN-${randomUUID()}`,lodgeId:lodge.id,roomTypeId:roomType.id,cityId:city.id,pilgrimUserId:guest.id,guestName:'Synthetic guest',guestPhone:'+919999999999',numberOfAdults:1,numberOfChildren:0,totalGuests:1,checkInDate:new Date('2026-11-16'),checkOutDate:new Date('2026-11-17'),totalAmount:amount,status,paymentStatus,createdAt:new Date(createdAt)}});}
      const online=await booking(4500,'ACCEPTED','FULLY_PAID','2026-11-15T18:31:00Z');
      const offline=await booking(2000,'CHECKED_IN','PAY_AT_LODGE','2026-11-16T10:00:00Z');
      const cancelled=await booking(9000,'CANCELLED','FULLY_PAID','2026-11-16T12:00:00Z');
      for(const [b,method]of [[online,'ONLINE'],[offline,'PAY_AT_LODGE'],[cancelled,'ONLINE']])await db.paymentCollection.create({data:{bookingId:b.id,method,provider:method==='ONLINE'?'RAZORPAY':null,amount:b.totalAmount,status:'PAID',paidAt:new Date()}});
      const access=new LodgeAccessService(db);const finance=new OwnerFinanceService(db,access);
      const actor={id:owner.id,roles:['OWNER'],isActive:true,phoneNumber:null};
      const captured=new Map();let gatewayWrites=0;
      const provider={createPayment:async(input)=>{gatewayWrites++;return{orderId:`order_${input.receipt}`,amount:input.amount,currency:input.currency};},getOrderPayments:async id=>captured.get(id)??[],getOrdersByReceipt:async()=>[],verifyPayment:async()=>({verified:true})};
      const payments=new CommissionPaymentService(db,access,provider);
      const ledger=new LodgeCommissionFinanceService({},access,db);
      const controller=new OwnerFinanceController(finance,payments);
      await t.test('date groups, gross revenue, received collections and stored commissions agree',async()=>{
        const page=await finance.owner(lodge.id,actor,{startDate:'2026-11-16',endDate:'2026-11-16',day:'2026-11-16'});
        assert.equal(page.summary.bookings,3);assert.equal(Number(page.summary.revenue),6500);assert.equal(Number(page.summary.commission),975);
        assert.equal(Number(page.summary.onlineReceived),4500);assert.equal(Number(page.summary.offlineReceived),2000);
        assert.equal(Number(page.balance.payable),300);assert.equal(Number(page.balance.ownerPayable),3825);
        assert.equal(page.days[0].date,'2026-11-16');
        assert.equal(Number(page.bookings.find(b=>b.id===online.id).receivedAmount),4500);
        assert.equal(Number(page.bookings.find(b=>b.id===cancelled.id).receivedAmount),0);
        assert.equal((await finance.owner(lodge.id,actor,{startDate:'2026-11-15',endDate:'2026-11-15'})).summary.bookings,0);
        await assert.rejects(finance.owner(lodge.id,{...actor,id:stranger.id},{}),/assigned lodges/);
      });
      await t.test('configuration changes preserve historical commission rates and report values',async()=>{
        await sql.query('UPDATE lodge_commission_settings SET commission_rate_percent=25 WHERE lodge_id=$1',[lodge.id]);
        const page=await finance.owner(lodge.id,actor,{});assert.equal(Number(page.summary.commission),975);
        assert.equal(Number(page.bookings.find(b=>b.id===online.id).rate),15);
      });
      await t.test('partial capture is applied once and a full follow-up clears only owner debt',async()=>{
        const partial=await payments.create(lodge.id,actor,10000,'PARTIAL');
        assert.equal(partial.amountPaise,10000);assert.equal(partial.paymentType,'PARTIAL');
        assert.equal((await payments.create(lodge.id,actor,10000,'PARTIAL')).orderId,partial.orderId);assert.equal(gatewayWrites,1);
        assert.equal((await payments.detail(partial.id,actor)).status,'PENDING');
        captured.set(partial.orderId,[{id:`pay_${randomUUID()}`,order_id:partial.orderId,amount:10000,currency:'INR',status:'captured',captured:true,method:'upi'}]);
        await Promise.all([payments.reconcile(partial.id),payments.reconcile(partial.id)]);
        assert.equal((await payments.detail(partial.id,actor)).remainingAfterPaise,20000);
        assert.equal(Number((await finance.owner(lodge.id,actor,{})).balance.payable),200);
        const full=await payments.create(lodge.id,actor,20000,'FULL');
        captured.set(full.orderId,[{id:`pay_${randomUUID()}`,order_id:full.orderId,amount:20000,currency:'INR',status:'captured',captured:true,method:'upi'}]);
        await payments.reconcile(full.id);await payments.reconcile(full.id);
        const page=await finance.owner(lodge.id,actor,{});assert.equal(Number(page.balance.payable),0);assert.equal(Number(page.balance.paid),300);
        assert.equal(Number(page.balance.ownerPayable),3825);assert.equal(page.paymentTotalItems,2);
        assert.equal(await db.notification.count({where:{recipientUserId:owner.id}}),2);
        const history=await finance.history({ownerId:owner.id,status:'SUCCESSFUL'});assert.equal(history.totalItems,2);assert.equal(history.summary.receivedPaise,30000);
        const receipt=await controller.receipt(full.id,actor);assert.equal(Buffer.from(receipt.base64,'base64').subarray(0,5).toString(),'%PDF-');
        await assert.rejects(payments.create(lodge.id,actor,100,'FULL'),/No payable/);
        await assert.rejects(sql.query("UPDATE audit_logs SET action='tampered' WHERE entity_type='commission_payment'"),/immutable/);
        await assert.rejects(sql.query('UPDATE commission_payment_items SET amount_paise=1'),/immutable/);
      });
      await t.test('revenue transfer deducts online commission once and exposes a masked linked receipt',async()=>{
        const key=randomUUID();const dto={amount:3825,idempotencyKey:key,paymentMethod:'BANK_TRANSFER',reference:'TEST-REVENUE-TRANSFER',notes:'Synthetic transfer',bankName:'Test bank',accountLast4:'1234'};
        await ledger.createRevenueSettlement(lodge.id,dto,owner.id);await ledger.createRevenueSettlement(lodge.id,dto,owner.id);
        const page=await finance.owner(lodge.id,actor,{});assert.equal(Number(page.balance.ownerReceived),3825);assert.equal(Number(page.balance.deducted),675);assert.equal(Number(page.balance.ownerPayable),0);assert.equal(page.settlements.length,1);
        const receipt=await finance.settlement(lodge.id,page.settlements[0].id,actor);assert.equal(receipt.accountLast4,'1234');assert.equal(receipt.bookings.length,1);assert.equal(receipt.bookings[0].bookingId,online.id);assert.equal(Number(receipt.bookings[0].commission),675);
        const previousPeriod=await finance.owner(lodge.id,actor,{startDate:'2026-10-01',endDate:'2026-10-31'});assert.equal(previousPeriod.settlements.length,0);assert.equal(Number(previousPeriod.balance.ownerReceived),3825);
        const exported=await controller.exportOwner(lodge.id,actor,{day:'2026-11-16',format:'csv',kind:'revenue'});const csv=Buffer.from(exported.base64,'base64').toString();assert.match(csv,/6500/);assert.match(csv,/975/);
      });
    }finally{await db.$disconnect();await sql.end();await admin.query(`DROP DATABASE "${name}"`);await admin.end();}
  });
