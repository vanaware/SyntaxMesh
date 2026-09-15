import { TjTime } from './packages/core/src/time/tj-time.ts';
const t1 = TjTime.fromString('2026-01-01-00:00:00');
const t2 = TjTime.fromString('2026-01-01-02:00:00');
const t3 = TjTime.fromString('2026-01-01-01:00:00');
const t4 = TjTime.fromString('2026-01-01-03:00:00');

// Test JavaScript operators vs methods
console.log('t1 < t3 (JS operator):', t1 < t3);
console.log('t1.lessThan(t3):', t1.lessThan(t3));
console.log('t3 < t2 (JS operator):', t3 < t2);
console.log('t3.lessThan(t2):', t3.lessThan(t2));
console.log('t2 < t4 (JS operator):', t2 < t4);
console.log('t2.lessThan(t4):', t2.lessThan(t4));

// Test === operator
console.log('t1 === t1:', t1 === t1);
console.log('t1 === t3:', t1 === t3);