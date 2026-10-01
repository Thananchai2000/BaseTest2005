// Simulated factory data. Replace with real sources (PLC/SCADA/database) later:
// keep snapshot() returning the same shape and the dashboard keeps working.
'use strict';

const machines = [
  { id: 'L1-CNC01', line: 'Line 1 - Machining', name: 'CNC Lathe #1',     temp: 62, rpm: 1800, unit: 'pcs', rate: 42, count: 0, status: 'RUN' },
  { id: 'L1-CNC02', line: 'Line 1 - Machining', name: 'CNC Mill #2',      temp: 58, rpm: 2400, unit: 'pcs', rate: 38, count: 0, status: 'RUN' },
  { id: 'L2-PRS01', line: 'Line 2 - Pressing',  name: 'Hydraulic Press',  temp: 71, rpm: 0,    unit: 'pcs', rate: 55, count: 0, status: 'RUN' },
  { id: 'L2-WLD01', line: 'Line 2 - Pressing',  name: 'Welding Robot',    temp: 84, rpm: 0,    unit: 'pcs', rate: 30, count: 0, status: 'RUN' },
  { id: 'L3-PKG01', line: 'Line 3 - Packaging', name: 'Auto Packer',      temp: 39, rpm: 900,  unit: 'box', rate: 60, count: 0, status: 'IDLE' },
  { id: 'L3-CNV01', line: 'Line 3 - Packaging', name: 'Conveyor Belt A',  temp: 36, rpm: 450,  unit: 'm/min', rate: 0, count: 0, status: 'RUN' }
];

const alarms = [];
const TARGET_PER_DAY = 5000;
let produced = 1850, defects = 37, energyKwh = 4210;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function log(level, text) {
  alarms.unshift({ time: new Date().toISOString(), level, text });
  if (alarms.length > 15) alarms.pop();
}
log('INFO', 'System started');

function tick() {
  let newlyProduced = 0;
  for (const m of machines) {
    if (m.status === 'RUN') {
      m.temp = clamp(m.temp + rand(-1.5, 1.6), 30, 110);
      const made = Math.round(m.rate / 30 * rand(0.6, 1.2)); // tick = 2s
      m.count += made;
      if (m.unit === 'pcs' || m.unit === 'box') newlyProduced += made;
      if (m.temp > 90 && Math.random() < 0.2) { m.status = 'FAULT'; log('ALARM', `${m.name}: over-temperature (${m.temp.toFixed(0)} C)`); }
      else if (Math.random() < 0.004) { m.status = 'FAULT'; log('ALARM', `${m.name}: unexpected stop`); }
      else if (Math.random() < 0.01) { m.status = 'IDLE'; log('INFO', `${m.name}: waiting for material`); }
    } else if (m.status === 'IDLE') {
      m.temp = clamp(m.temp - 1, 30, 110);
      if (Math.random() < 0.25) { m.status = 'RUN'; log('INFO', `${m.name}: resumed`); }
    } else { // FAULT: cools down, auto-recovers after maintenance
      m.temp = clamp(m.temp - 2.5, 30, 110);
      if (Math.random() < 0.08) { m.status = 'RUN'; log('INFO', `${m.name}: fault cleared by maintenance`); }
    }
  }
  produced += newlyProduced;
  defects += Math.random() < 0.15 ? 1 : 0;
  energyKwh += rand(0.4, 0.9) * machines.filter(m => m.status === 'RUN').length;
}
setInterval(tick, 2000).unref();

function snapshot() {
  const running = machines.filter(m => m.status === 'RUN').length;
  const availability = running / machines.length;
  const quality = produced ? (produced - defects) / produced : 1;
  return {
    time: new Date().toISOString(),
    kpi: {
      produced, target: TARGET_PER_DAY, defects,
      defectRate: produced ? defects / produced * 100 : 0,
      oee: availability * 0.92 * quality * 100,
      energyKwh: Math.round(energyKwh),
      running, total: machines.length
    },
    machines: machines.map(m => ({ ...m, temp: Math.round(m.temp * 10) / 10 })),
    alarms
  };
}

module.exports = { snapshot };
