import { useState, useCallback, useEffect } from 'react';
import {
  getMySubscription,
  createPaymentOrder,
  verifyClientPayment,
  getMyInvoices,
  getInvoicePdfUrl
} from '../services/subscription.api';

/**
 * Dynamically loads the Razorpay checkout script if not already present on window
 */
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function useSubscription() {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMySubscription();
      if (res.success) {
        setSubscriptionData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch subscription details:', err);
      setError(err.response?.data?.message || 'Failed to load subscription.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await getMyInvoices();
      if (res.success) {
        setInvoices(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    }
  }, []);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  /**
   * Initiate Razorpay Payment Checkout
   * @param {Object} options
   * @param {string} options.planKey 'pro' | 'premium'
   * @param {string} [options.billingCycle='MONTHLY']
   * @param {Object} [options.user] { username, email }
   * @param {Function} [options.onSuccess]
   * @param {Function} [options.onFailure]
   */
  const initiateCheckout = async ({
    planKey,
    billingCycle = 'MONTHLY',
    user = {},
    onSuccess,
    onFailure
  }) => {
    try {
      setCheckoutLoading(true);
      setError(null);

      // 1. Ensure Razorpay SDK script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection and try again.');
      }

      // 2. Create server-side order
      const orderRes = await createPaymentOrder({ planKey, billingCycle });
      if (!orderRes.success || !orderRes.data) {
        throw new Error(orderRes.message || 'Failed to create payment order.');
      }

      const { gatewayOrderId, amount, currency, keyId, orderId } = orderRes.data;

      // 3. Configure Razorpay Popup Options
      const options = {
        key: keyId,
        amount,
        currency: currency || 'INR',
        name: 'KIVI-AI',
        description: `${planKey.toUpperCase()} Subscription (${billingCycle})`,
        image: '/Logo.png',
        order_id: gatewayOrderId,
        prefill: {
          name: user?.username || '',
          email: user?.email || ''
        },
        theme: {
          color: '#6366f1' // Indigo brand theme
        },
        modal: {
          ondismiss: () => {
            setCheckoutLoading(false);
            if (onFailure) onFailure('Payment window closed by user.');
          }
        },
        handler: async (response) => {
          try {
            // 4. Client signature verification & instant activation
            const verifyRes = await verifyClientPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId
            });

            if (verifyRes.success) {
              await fetchSubscription();
              await fetchInvoices();
              if (onSuccess) onSuccess(verifyRes.data);
            } else {
              throw new Error(verifyRes.message || 'Payment verification failed.');
            }
          } catch (vErr) {
            console.error('Payment verification failed:', vErr);
            const msg = vErr.response?.data?.message || vErr.message || 'Payment verification failed.';
            setError(msg);
            if (onFailure) onFailure(msg);
          } finally {
            setCheckoutLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        if (import.meta.env.DEV) {
          console.warn('Payment failed on gateway:', response.error);
        }
        setCheckoutLoading(false);
        const failMsg = response.error?.description || 'Payment was unsuccessful. Please retry.';
        setError(failMsg);
        if (onFailure) onFailure(failMsg);
      });

      rzp.open();
    } catch (err) {
      console.error('Checkout error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to start payment.';
      setError(msg);
      setCheckoutLoading(false);
      if (onFailure) onFailure(msg);
    }
  };

  return {
    subscriptionData,
    invoices,
    loading,
    checkoutLoading,
    error,
    fetchSubscription,
    fetchInvoices,
    initiateCheckout,
    getInvoicePdfUrl
  };
}
