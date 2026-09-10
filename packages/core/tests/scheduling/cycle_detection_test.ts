import { describe, it, } from '@std/testing/bdd';
import { assertEquals, } from '@std/assert';
import { detectCycles, formatCycle, } from '../../src/scheduling/cycle-detection.ts';
import type { Task, } from '../../src/mod.ts';

describe('Cycle Detection', () => {
  describe('detectCycles', () => {
    it('should detect no cycles in acyclic graph', () => {
      const tasks: Task[] = [
        { id: '1', name: 'Task 1', dependencies: [], effort: '1h', duration: '1h', },
        { id: '2', name: 'Task 2', dependencies: ['1',], effort: '1h', duration: '1h', },
        { id: '3', name: 'Task 3', dependencies: ['2',], effort: '1h', duration: '1h', },
      ];

      const result = detectCycles(tasks,);
      assertEquals(result.hasCycle, false,);
      assertEquals(result.cycles.length, 0,);
    });

    it('should detect a simple cycle', () => {
      const tasks: Task[] = [
        { id: '1', name: 'Task 1', dependencies: ['2',], effort: '1h', duration: '1h', },
        { id: '2', name: 'Task 2', dependencies: ['1',], effort: '1h', duration: '1h', },
      ];

      const result = detectCycles(tasks,);
      assertEquals(result.hasCycle, true,);
      assertEquals(result.cycles.length, 1,);
      assertEquals(result.cycles[0], ['1', '2', '1',],);
    });

    it('should detect multiple cycles', () => {
      const tasks: Task[] = [
        { id: '1', name: 'Task 1', dependencies: ['2',], effort: '1h', duration: '1h', },
        { id: '2', name: 'Task 2', dependencies: ['1',], effort: '1h', duration: '1h', },
        { id: '3', name: 'Task 3', dependencies: ['4',], effort: '1h', duration: '1h', },
        { id: '4', name: 'Task 4', dependencies: ['3',], effort: '1h', duration: '1h', },
      ];

      const result = detectCycles(tasks,);
      assertEquals(result.hasCycle, true,);
      assertEquals(result.cycles.length, 2,);
      assertEquals(result.cycles[0], ['1', '2', '1',],);
      assertEquals(result.cycles[1], ['3', '4', '3',],);
    });

    it('should detect a complex cycle', () => {
      const tasks: Task[] = [
        { id: '1', name: 'Task 1', dependencies: ['2',], effort: '1h', duration: '1h', },
        { id: '2', name: 'Task 2', dependencies: ['3',], effort: '1h', duration: '1h', },
        { id: '3', name: 'Task 3', dependencies: ['1',], effort: '1h', duration: '1h', },
      ];

      const result = detectCycles(tasks,);
      assertEquals(result.hasCycle, true,);
      assertEquals(result.cycles.length, 1,);
      assertEquals(result.cycles[0], ['1', '2', '3', '1',],);
    });

    it('should handle tasks with no dependencies', () => {
      const tasks: Task[] = [
        { id: '1', name: 'Task 1', dependencies: [], effort: '1h', duration: '1h', },
        { id: '2', name: 'Task 2', dependencies: [], effort: '1h', duration: '1h', },
      ];

      const result = detectCycles(tasks,);
      assertEquals(result.hasCycle, false,);
      assertEquals(result.cycles.length, 0,);
    });

    it('should handle empty task list', () => {
      const result = detectCycles([],);
      assertEquals(result.hasCycle, false,);
      assertEquals(result.cycles.length, 0,);
    });
  });

  describe('formatCycle', () => {
    it('should format a simple cycle correctly', () => {
      const cycle = ['1', '2', '1',];
      assertEquals(formatCycle(cycle,), '1 → 2 → 1',);
    });

    it('should format a complex cycle correctly', () => {
      const cycle = ['1', '2', '3', '1',];
      assertEquals(formatCycle(cycle,), '1 → 2 → 3 → 1',);
    });

    it('should handle single node cycle', () => {
      const cycle = ['1', '1',];
      assertEquals(formatCycle(cycle,), '1 → 1',);
    });
  });
});
