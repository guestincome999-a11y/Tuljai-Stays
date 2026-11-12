-- Only the new owner collection action uses this deterministic reference.
-- Historical payment rows and online-provider references are unchanged.
CREATE UNIQUE INDEX "payment_collections_owner_cash_reference_key"
ON "payment_collections" ("provider_reference")
WHERE "method" = 'PAY_AT_LODGE'
  AND "provider_reference" LIKE 'owner-pay-at-lodge:%';
