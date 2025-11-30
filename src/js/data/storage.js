/**
 * src/js/data/storage.js
 * LocalStorage 관리 모듈
 */

import { STORAGE_KEYS } from '../config.js';

import { supabase } from './supabaseClient.js';

export const Storage = {
    /**
     * 데이터 저장 (Supabase + LocalStorage)
     * @param {string} key - 저장 키 ('staff' or 'settings')
     * @param {any} data - 저장할 데이터
     * @returns {Promise<boolean>} 성공 여부
     */
    async save(key, data) {
        // 1. LocalStorage에 즉시 저장 (Optimistic update)
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('LocalStorage save failed:', e);
        }

        // 2. Supabase에 저장
        try {
            // 테이블 이름 매핑 (staff -> staff, settings -> settings)
            // 데이터 구조에 따라 upsert 방식이 다를 수 있음

            if (key === 'staff') {
                // Staff 리스트 전체를 저장하는 대신, 개별 변경사항을 저장하는 것이 좋지만
                // 현재 구조상 전체 리스트를 덮어쓰거나, 개별 upsert를 해야 함.
                // 간단하게 구현하기 위해: staff 테이블에 id별로 upsert

                if (Array.isArray(data)) {
                    const updates = data.map(s => ({
                        id: s.id,
                        name: s.name,
                        status: s.status,
                        assignment: s.assignment,
                        updated_at: new Date().toISOString()
                    }));

                    const { error } = await supabase
                        .from('staff')
                        .upsert(updates);

                    if (error) throw error;
                }
            } else if (key === 'settings') {
                const { error } = await supabase
                    .from('settings')
                    .upsert({
                        id: 'global_settings',
                        config: data,
                        updated_at: new Date().toISOString()
                    });

                if (error) throw error;
            }

            return true;
        } catch (error) {
            console.error('Supabase save failed:', error);
            return false;
        }
    },

    /**
     * 데이터 불러오기
     * @param {string} key 
     */
    load(key) {
        // 동기적으로 LocalStorage 반환 (초기 렌더링용)
        try {
            const serialized = localStorage.getItem(key);
            return serialized ? JSON.parse(serialized) : null;
        } catch (error) {
            return null;
        }
    },

    /**
     * Supabase에서 최신 데이터 가져오기 (비동기)
     * @param {string} key 
     */
    async fetchLatest(key) {
        try {
            if (key === 'staff') {
                const { data, error } = await supabase.from('staff').select('*');
                if (error) throw error;
                return data;
            } else if (key === 'settings') {
                const { data, error } = await supabase
                    .from('settings')
                    .select('config')
                    .eq('id', 'global_settings')
                    .single();
                if (error) throw error;
                return data?.config || null;
            }
        } catch (error) {
            console.error(`Failed to fetch latest ${key}:`, error);
            return null;
        }
    },

    /**
     * 실시간 구독
     * @param {Function} onStaffChange 
     * @param {Function} onSettingsChange 
     */
    subscribe(onStaffChange, onSettingsChange) {
        const channel = supabase.channel('schema-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'staff' },
                (payload) => {
                    console.log('Staff change received:', payload);
                    // 전체 리스트를 다시 가져오는 것이 가장 안전함 (순서 등 고려)
                    this.fetchLatest('staff').then(data => {
                        if (data) onStaffChange(data);
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'settings' },
                (payload) => {
                    console.log('Settings change received:', payload);
                    if (payload.new && payload.new.config) {
                        onSettingsChange(payload.new.config);
                    }
                }
            )
            .subscribe();

        return channel;
    },

    remove(key) {
        localStorage.removeItem(key);
        // Supabase 삭제 로직은 필요시 구현 (현재는 전체 삭제 기능이 없으므로 패스)
    },

    has(key) {
        return localStorage.getItem(key) !== null;
    }
};
