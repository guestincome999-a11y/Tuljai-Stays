declare module 'react-native-razorpay' {
  export interface RazorpayCheckoutOptions {
    key: string;
    amount: number | string;
    currency: string;
    order_id: string;
    name?: string;
    description?: string;
    image?: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
    };
  }

  export interface RazorpayPaymentResult {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpayPaymentResult>;
  };

  export default RazorpayCheckout;
}
