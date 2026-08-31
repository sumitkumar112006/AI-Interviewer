/**
 * Unit Test Runner for Payment Logic
 * Executes the user's test suite against services/paymentLogic.js with explicit test numbering.
 */

const {
  computeOrderAmount,
  buildIdempotencyKey,
  decideWebhookAction,
  computeInvoiceTotals,
  decideRefundStatus,
  isOrderExpired,
} = require('../services/paymentLogic');

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  const testNum = total;
  try {
    fn();
    console.log(`  ✅ [Test #${testNum}] PASS: ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [Test #${testNum}] FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    not: {
      toBe(expected) {
        if (actual === expected) {
          throw new Error(`Expected value NOT to be ${JSON.stringify(expected)}`);
        }
      }
    },
    toThrow(expectedError) {
      let threw = false;
      let actualError = null;
      try {
        if (typeof actual === 'function') {
          actual();
        }
      } catch (e) {
        threw = true;
        actualError = e;
      }
      if (!threw) {
        throw new Error(`Expected function to throw, but it did not throw`);
      }
      if (expectedError && !actualError.message.includes(expectedError)) {
        throw new Error(`Expected error message to contain "${expectedError}", but got "${actualError.message}"`);
      }
    }
  };
}

console.log('🧪 Running Payment Logic Unit Tests (All 18 Cases)...\n');

console.log('📋 describe: computeOrderAmount');
test('uses the plan price, ignoring any client-sent amount', () => {
  const plan = { isActive: true, priceMonthly: 99900, priceYearly: 999900 };
  expect(computeOrderAmount(plan, 'MONTHLY')).toBe(99900);
  expect(computeOrderAmount(plan, 'YEARLY')).toBe(999900);
});

test('throws for an inactive plan', () => {
  const plan = { isActive: false, priceMonthly: 99900 };
  expect(() => computeOrderAmount(plan, 'MONTHLY')).toThrow('INVALID_PLAN');
});

console.log('\n📋 describe: buildIdempotencyKey');
test('two calls in the same time window produce the same key', () => {
  const k1 = buildIdempotencyKey('user1', 'plan1', 'MONTHLY', 60_000);
  const k2 = buildIdempotencyKey('user1', 'plan1', 'MONTHLY', 60_000);
  expect(k1).toBe(k2);
});

test('different users never collide', () => {
  const k1 = buildIdempotencyKey('user1', 'plan1', 'MONTHLY');
  const k2 = buildIdempotencyKey('user2', 'plan1', 'MONTHLY');
  expect(k1).not.toBe(k2);
});

console.log('\n📋 describe: decideWebhookAction');
test('DUPLICATE when the webhook event already exists', () => {
  const action = decideWebhookAction({ webhookEventAlreadyExists: true, order: {}, eventType: 'payment.captured' });
  expect(action).toBe('DUPLICATE');
});

test('IGNORE_SETTLED for a success event on an already-PAID order', () => {
  const action = decideWebhookAction({
    webhookEventAlreadyExists: false,
    order: { status: 'PAID' },
    eventType: 'payment.captured',
  });
  expect(action).toBe('IGNORE_SETTLED');
});

test('PROCESS_SUCCESS for a first-time captured event on a PENDING order', () => {
  const action = decideWebhookAction({
    webhookEventAlreadyExists: false,
    order: { status: 'PENDING' },
    eventType: 'payment.captured',
  });
  expect(action).toBe('PROCESS_SUCCESS');
});

test('PROCESS_FAILURE for a failed event, order stays retryable', () => {
  const action = decideWebhookAction({
    webhookEventAlreadyExists: false,
    order: { status: 'PENDING' },
    eventType: 'payment.failed',
  });
  expect(action).toBe('PROCESS_FAILURE');
});

test('UNKNOWN_ORDER when no matching order is found', () => {
  const action = decideWebhookAction({ webhookEventAlreadyExists: false, order: null, eventType: 'payment.captured' });
  expect(action).toBe('UNKNOWN_ORDER');
});

console.log('\n📋 describe: computeInvoiceTotals');
test('computes subtotal, tax, and total correctly', () => {
  const items = [{ amount: 99900 }];
  const totals = computeInvoiceTotals(items, 18, 0);
  expect(totals.subtotal).toBe(99900);
  expect(totals.taxAmount).toBe(17982); // 18% of 99900, rounded
  expect(totals.totalAmount).toBe(117882);
});

test('applies a discount before tax total check', () => {
  const items = [{ amount: 50000 }];
  const totals = computeInvoiceTotals(items, 0, 10000);
  expect(totals.totalAmount).toBe(40000);
});

test('throws if discount exceeds subtotal + tax', () => {
  const items = [{ amount: 1000 }];
  expect(() => computeInvoiceTotals(items, 0, 5000)).toThrow('INVALID_TOTAL');
});

console.log('\n📋 describe: decideRefundStatus');
test('full refund', () => {
  expect(decideRefundStatus(99900, 99900)).toBe('REFUNDED');
});

test('partial refund', () => {
  expect(decideRefundStatus(99900, 30000)).toBe('PARTIALLY_REFUNDED');
});

test('no refund yet', () => {
  expect(decideRefundStatus(99900, 0)).toBe(null);
});

console.log('\n📋 describe: isOrderExpired');
test('expired PENDING order older than the window', () => {
  const order = { status: 'PENDING', createdAt: new Date(Date.now() - 40 * 60_000) };
  expect(isOrderExpired(order, 30)).toBe(true);
});

test('not expired within the window', () => {
  const order = { status: 'PENDING', createdAt: new Date(Date.now() - 5 * 60_000) };
  expect(isOrderExpired(order, 30)).toBe(false);
});

test('a PAID order is never "expired"', () => {
  const order = { status: 'PAID', createdAt: new Date(Date.now() - 40 * 60_000) };
  expect(isOrderExpired(order, 30)).toBe(false);
});

console.log(`\n🏁 Results: ${passed} / ${total} Unit Tests Passed!\n`);
process.exit(passed === total ? 0 : 1);
