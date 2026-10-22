import {test,expect} from '@playwright/test';
import {enclosure,initialProject,issues,validateProject} from '../src/engineering';
test('adaptive envelope, conflicts and import bounds',()=>{
 const p=initialProject();expect(validateProject(p)).toBe(true);expect(issues(p).filter(i=>i.includes('overlap'))).toEqual([]);
 const before=enclosure(p);p.parts.find(a=>a.id==='mic0')!.position[0]=-90;expect(enclosure(p)[0]).toBeGreaterThan(before[0]);
 p.wires.filter(w=>w.from.startsWith('mic')).forEach(w=>w.pin='same');expect(issues(p).some(s=>s.includes('Electrical conflict'))).toBe(true);
 p.parts[0].position[0]=Infinity;expect(validateProject(p)).toBe(false);
});
test('external webcam preserves enclosure and legacy project imports',()=>{
 const p=initialProject(), camera=p.parts.find(a=>a.id==='webcam')!;
 expect(camera.group).toBe('Imaging subsystem');
 const bounds=enclosure(p);
 camera.position=[150,150,150];camera.size=[90,50,40];
 expect(enclosure(p)).toEqual(bounds);
 expect(validateProject(p)).toBe(true);
 p.parts=p.parts.filter(a=>a.id!=='webcam');
 expect(validateProject(p)).toBe(true);
 p.parts=p.parts.filter(a=>a.id!=='oled');
 expect(validateProject(p)).toBe(false);
});
