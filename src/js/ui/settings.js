/**
 * src/js/ui/settings.js
 * 설정 UI 관리 (간소화 버전 - 인라인 설정 뷰 사용)
 */

import { DefaultSettings } from '../config.js';

export class SettingsUI {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 설정 저장
   * @param {Object} currentSettings 
   */
  saveFromView() {
    console.log('SettingsUI: saveFromView called');
    const arrKorean = document.getElementById('setting-arr-korean');
    const arrForeign = document.getElementById('setting-arr-foreign');
    const waitTime = document.getElementById('setting-wait-time');
    const utilization = document.getElementById('setting-utilization');
    const autogate = document.getElementById('setting-autogate');
    const darkmode = document.getElementById('setting-darkmode');

    const newSettings = {
      ...DefaultSettings,
      targetWaitTime: arrKorean ? Number(waitTime.value) : 15,
      targetUtilization: utilization ? Number(utilization.value) / 100 : 0.85,
      autoGateRatio: autogate ? Number(autogate.value) / 100 : 0.3,
      theme: darkmode?.checked ? 'dark' : 'light',
      serviceRates: {
        ...DefaultSettings.serviceRates,
        arrivalKorean: arrKorean ? Number(arrKorean.value) : 60,
        arrivalForeign: arrForeign ? Number(arrForeign.value) : 40
      }
    };

    console.log('SettingsUI: Emitting settings:changed', newSettings);
    this.eventBus.emit('settings:changed', newSettings);
    return newSettings;
  }
}
