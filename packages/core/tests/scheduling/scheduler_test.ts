import { describe, it, } from '@std/testing/bdd';
import { assert, assertEquals, } from '@std/assert';
import { schedule, } from '../../src/scheduling/mod.ts';
import type { Project, Task, } from '../../src/mod.ts';

describe('Scheduler', () => {
  describe('schedule', () => {
    it('should schedule a simple project with no dependencies', () => {
      const project: Project = {
        id: '1',
        name: 'Simple Project',
        tasks: [
          {
            id: '1',
            name: 'Task 1',
            dependencies: [],
            duration: '1d',
            effort: '8h',
          },
          {
            id: '2',
            name: 'Task 2',
            dependencies: [],
            duration: '2d',
            effort: '16h',
          },
        ],
        resources: [],
        scenarios: [],
        calendar: {
          workingDays: [1, 2, 3, 4, 5,],
          workingHours: { start: 8, end: 18, },
          holidays: [],
        },
        startDate: new Date(2024, 0, 1,), // 1 de janeiro de 2024
      };

      const result = schedule(project,);
      assertEquals(result.errors.length, 0,);
      assertEquals(result.tasks.length, 2,);
      assertEquals(result.hasCycles, false,);

      // Verifica datas das tarefas
      const task1 = result.tasks.find((t,) => t.id === '1');
      const task2 = result.tasks.find((t,) => t.id === '2');

      assert(task1,);
      assert(task2,);

      // Ambas as tarefas começam na data de início do projeto
      assertEquals(task1.startDate.toISOString().slice(0, 10,), '2024-01-01',);
      assertEquals(task2.startDate.toISOString().slice(0, 10,), '2024-01-01',);

      // Task 1 dura 1 dia, termina em 2024-01-02
      assertEquals(task1.endDate.toISOString().slice(0, 10,), '2024-01-02',);
      // Task 2 dura 2 dias, termina em 2024-01-03
      assertEquals(task2.endDate.toISOString().slice(0, 10,), '2024-01-03',);
    });

    it('should handle dependencies correctly', () => {
      const project: Project = {
        id: '1',
        name: 'Dependent Project',
        tasks: [
          {
            id: '1',
            name: 'Task 1',
            dependencies: [],
            duration: '1d',
            effort: '8h',
          },
          {
            id: '2',
            name: 'Task 2',
            dependencies: ['1',],
            duration: '1d',
            effort: '8h',
          },
        ],
        resources: [],
        scenarios: [],
        calendar: {
          workingDays: [1, 2, 3, 4, 5,],
          workingHours: { start: 8, end: 18, },
          holidays: [],
        },
        startDate: new Date(2024, 0, 1,), // 1 de janeiro de 2024
      };

      const result = schedule(project,);
      assertEquals(result.errors.length, 0,);
      assertEquals(result.tasks.length, 2,);
      assertEquals(result.hasCycles, false,);

      const task1 = result.tasks.find((t,) => t.id === '1');
      const task2 = result.tasks.find((t,) => t.id === '2');

      assert(task1,);
      assert(task2,);

      // Task 1 começa em 2024-01-01 e termina em 2024-01-02
      assertEquals(task1.startDate.toISOString().slice(0, 10,), '2024-01-01',);
      assertEquals(task1.endDate.toISOString().slice(0, 10,), '2024-01-02',);

      // Task 2 depende de Task 1, então começa em 2024-01-02 e termina em 2024-01-03
      assertEquals(task2.startDate.toISOString().slice(0, 10,), '2024-01-02',);
      assertEquals(task2.endDate.toISOString().slice(0, 10,), '2024-01-03',);
    });

    it('should detect cycles in dependencies', () => {
      const project: Project = {
        id: '1',
        name: 'Cyclic Project',
        tasks: [
          {
            id: '1',
            name: 'Task 1',
            dependencies: ['2',],
            duration: '1d',
            effort: '8h',
          },
          {
            id: '2',
            name: 'Task 2',
            dependencies: ['1',],
            duration: '1d',
            effort: '8h',
          },
        ],
        resources: [],
        scenarios: [],
        calendar: {
          workingDays: [1, 2, 3, 4, 5,],
          workingHours: { start: 8, end: 18, },
          holidays: [],
        },
        startDate: new Date(2024, 0, 1,),
      };

      const result = schedule(project,);
      assertEquals(result.hasCycles, true,);
      assertEquals(result.errors.length, 1,);
      assert(!!result.errors[0] && result.errors[0].includes('Ciclo detectado',),);
      assertEquals(result.tasks.length, 0,); // Não deve agendar tarefas com ciclos
    });

    it('should calculate slack and critical path', () => {
      const project: Project = {
        id: '1',
        name: 'Critical Path Project',
        tasks: [
          {
            id: '1',
            name: 'Task 1',
            dependencies: [],
            duration: '1d',
            effort: '8h',
          },
          {
            id: '2',
            name: 'Task 2',
            dependencies: ['1',],
            duration: '1d',
            effort: '8h',
          },
          {
            id: '3',
            name: 'Task 3',
            dependencies: ['1',],
            duration: '2d',
            effort: '16h',
          },
        ],
        resources: [],
        scenarios: [],
        calendar: {
          workingDays: [1, 2, 3, 4, 5,],
          workingHours: { start: 8, end: 18, },
          holidays: [],
        },
        startDate: new Date(2024, 0, 1,), // 1 de janeiro de 2024
      };

      const result = schedule(project,);
      assertEquals(result.errors.length, 0,);
      assertEquals(result.hasCycles, false,);

      const task1 = result.tasks.find((t,) => t.id === '1');
      const task2 = result.tasks.find((t,) => t.id === '2');
      const task3 = result.tasks.find((t,) => t.id === '3');

      assert(task1,);
      assert(task2,);
      assert(task3,);

      // Task 1: 2024-01-01 a 2024-01-02
      assertEquals(task1.startDate.toISOString().slice(0, 10,), '2024-01-01',);
      assertEquals(task1.endDate.toISOString().slice(0, 10,), '2024-01-02',);

      // Task 2: depende de Task 1, 2024-01-02 a 2024-01-03
      assertEquals(task2.startDate.toISOString().slice(0, 10,), '2024-01-02',);
      assertEquals(task2.endDate.toISOString().slice(0, 10,), '2024-01-03',);

      // Task 3: depende de Task 1, 2024-01-02 a 2024-01-04 (2 dias)
      assertEquals(task3.startDate.toISOString().slice(0, 10,), '2024-01-02',);
      assertEquals(task3.endDate.toISOString().slice(0, 10,), '2024-01-04',);

      // Task 3 está no caminho crítico (termina depois de Task 2)
      assertEquals(task3.isCritical, true,);
      assertEquals(task2.isCritical, false,); // Tem folga

      // Task 2 tem folga positiva (pode começar mais tarde)
      assert(task2.slack > 0,);
      // Task 3 não tem folga (caminho crítico)
      assertEquals(task3.slack, 0,);
    });

    it('should handle complex dependencies', () => {
      const project: Project = {
        id: '1',
        name: 'Complex Project',
        tasks: [
          { id: '1', name: 'Task 1', dependencies: [], duration: '1d', effort: '8h', },
          { id: '2', name: 'Task 2', dependencies: ['1',], duration: '1d', effort: '8h', },
          { id: '3', name: 'Task 3', dependencies: ['1',], duration: '1d', effort: '8h', },
          { id: '4', name: 'Task 4', dependencies: ['2', '3',], duration: '1d', effort: '8h', },
        ],
        resources: [],
        scenarios: [],
        calendar: {
          workingDays: [1, 2, 3, 4, 5,],
          workingHours: { start: 8, end: 18, },
          holidays: [],
        },
        startDate: new Date(2024, 0, 1,),
      };

      const result = schedule(project,);
      assertEquals(result.errors.length, 0,);
      assertEquals(result.hasCycles, false,);

      const task1 = result.tasks.find((t,) => t.id === '1');
      const task2 = result.tasks.find((t,) => t.id === '2');
      const task3 = result.tasks.find((t,) => t.id === '3');
      const task4 = result.tasks.find((t,) => t.id === '4');

      assert(task1,);
      assert(task2,);
      assert(task3,);
      assert(task4,);

      // Task 1: 2024-01-01 a 2024-01-02
      assertEquals(task1.startDate.toISOString().slice(0, 10,), '2024-01-01',);
      assertEquals(task1.endDate.toISOString().slice(0, 10,), '2024-01-02',);

      // Task 2 e Task 3: ambas dependem de Task 1, começam em 2024-01-02
      assertEquals(task2.startDate.toISOString().slice(0, 10,), '2024-01-02',);
      assertEquals(task2.endDate.toISOString().slice(0, 10,), '2024-01-03',);
      assertEquals(task3.startDate.toISOString().slice(0, 10,), '2024-01-02',);
      assertEquals(task3.endDate.toISOString().slice(0, 10,), '2024-01-03',);

      // Task 4 depende de Task 2 e Task 3, começa quando ambas terminam (2024-01-03)
      assertEquals(task4.startDate.toISOString().slice(0, 10,), '2024-01-03',);
      assertEquals(task4.endDate.toISOString().slice(0, 10,), '2024-01-04',);
    });
  });
});
