import { registerGlobals } from '@livekit/react-native';

let hasRegisteredGlobals = false;

export function ensureLiveKitGlobals() {
  if (hasRegisteredGlobals) {
    return;
  }

  registerGlobals();
  hasRegisteredGlobals = true;
}
