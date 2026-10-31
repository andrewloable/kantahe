import { DeviceType } from '../gen/kantahe/v1/common_pb';

/** What differs between the web build and the packaged TV builds (angular.json swaps environment.ts for a TV file). */
export interface Environment {
  /** A packaged TV app: no page origin to talk to, code sign-in, remote-control navigation. */
  isTv: boolean;
  /** What the code sign-in tells the server this device is. */
  tvDeviceType: DeviceType;
}
