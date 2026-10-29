import {
  LuActivity, LuAmbulance, LuCable, LuCircleDot, LuFlame, LuHeartPulse, LuHospital, LuMilestone, LuPill,
  LuRadio, LuRadioTower, LuRoute, LuServer, LuShieldAlert, LuSiren, LuZap,
} from 'react-icons/lu';

export const NODE_ICONS = {
  junction: LuMilestone, bridge: LuRoute, hospital: LuHospital, department: LuHeartPulse, supply: LuPill,
  intake: LuZap, substation: LuActivity, hub: LuCable, core: LuServer, tower: LuRadioTower, repeater: LuRadio,
  control: LuSiren, ambulance: LuAmbulance, fire: LuFlame, police: LuShieldAlert,
};
export const iconFor = (type) => NODE_ICONS[type] || LuCircleDot;
