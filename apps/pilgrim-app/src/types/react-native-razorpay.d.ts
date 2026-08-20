declare module 'react-native-razorpay' {
  interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name?: string;
    description?: string;
    order_id: string;
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

  interface RazorpaySuccessResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  interface RazorpayCheckout {
    open(
      options: RazorpayCheckoutOptions,
    ): Promise<RazorpaySuccessResponse>;
  }

  const RazorpayCheckout: RazorpayCheckout;

  export default RazorpayCheckout;
}