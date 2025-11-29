/**
 * src/js/data/storage.js
 * LocalStorage 관리 모듈
 */

import { STORAGE_KEYS } from '../config.js';

export const Storage = {
    /**
     * 데이터 저장
     * @param {string} key - 저장 키
     * @param {any} data - 저장할 데이터 (JSON 직렬화 가능해야 함)
     * @returns {boolean} 성공 여부
     */
    save(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Storage Save Error:', error);
            return false;
        }
    },

    /**
     * 데이터 불러오기
     * @param {string} key - 저장 키
     * @returns {any|null} 파싱된 데이터 또는 null
     */
    load(key) {
        try {
            const serialized = localStorage.getItem(key);
            if (!serialized) return null;
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Storage Load Error:', error);
            return null;
        }
    },

    /**
     * 데이터 삭제
     * @param {string} key - 저장 키
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Storage Remove Error:', error);
        }
    },

    /**
     * 전체 데이터 삭제 (주의)
     */
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Storage Clear Error:', error);
        }
    },

    /**
     * 특정 키가 존재하는지 확인
     * @param {string} key 
     */
    has(key) {
        return localStorage.getItem(key) !== null;
    }
};
