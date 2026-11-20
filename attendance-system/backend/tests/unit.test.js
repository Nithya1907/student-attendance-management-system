const test = require('node:test');
const assert = require('node:assert');
const { calcPercentage } = require('../src/utils/attendance');

test('percentage with two decimals', () => assert.strictEqual(calcPercentage(2, 1, 0), 66.67));
test('zero eligible sessions does not divide by zero', () => assert.strictEqual(calcPercentage(0, 0, 0), 0));
test('leave counts as eligible but NOT present', () => assert.strictEqual(calcPercentage(3, 0, 1), 75));
test('all present is 100', () => assert.strictEqual(calcPercentage(10, 0, 0), 100));
test('all absent is 0', () => assert.strictEqual(calcPercentage(0, 5, 0), 0));
