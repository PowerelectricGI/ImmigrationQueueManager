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
  saveFromView(currentSettings = DefaultSettings) {
    console.log('SettingsUI: saveFromView called');
    const arrKorean = document.getElementById('setting-arr-korean');
    const arrForeign = document.getElementById('setting-arr-foreign');
    const waitTime = document.getElementById('setting-wait-time');
    const utilization = document.getElementById('setting-utilization');
    const autogate = document.getElementById('setting-autogate');
    const darkmode = document.getElementById('setting-darkmode');

    const newSettings = {
      ...currentSettings,
      targetWaitTime: arrKorean ? Number(waitTime.value) : currentSettings.targetWaitTime,
      targetUtilization: utilization ? Number(utilization.value) / 100 : currentSettings.targetUtilization,
      autoGateRatio: autogate ? Number(autogate.value) / 100 : currentSettings.autoGateRatio,
      theme: darkmode?.checked ? 'dark' : 'light',
      serviceRates: {
        ...currentSettings.serviceRates,
        arrivalKorean: arrKorean ? Number(arrKorean.value) : currentSettings.serviceRates.arrivalKorean,
        arrivalForeign: arrForeign ? Number(arrForeign.value) : currentSettings.serviceRates.arrivalForeign
      }
    };

    console.log('SettingsUI: Emitting settings:changed', newSettings);
    this.eventBus.emit('settings:changed', newSettings);
    return newSettings;
  }
}
