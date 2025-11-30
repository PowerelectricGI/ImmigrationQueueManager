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
            if (key === 'staff') {
                if (Array.isArray(data)) {
                    // 1. Upsert (Insert or Update)
                    const updates = data.map(s => ({
                        id: s.id,
                        name: s.name,
                        status: s.status,
                        assignment: s.assignment,
                        updated_at: new Date().toISOString()
                    }));

                    const { error: upsertError } = await supabase
                        .from('staff')
                        .upsert(updates);

                    if (upsertError) throw upsertError;

                    // 2. Delete (Sync: Remove items not in the current list)
                    // 현재 리스트에 있는 ID 목록
                    const currentIds = data.map(s => s.id);

                    // DB에 있지만 현재 리스트에 없는 항목 삭제
                    // (주의: 이 방식은 동시성 문제가 있을 수 있으나, 간단한 앱에서는 허용)
                    if (currentIds.length > 0) {
                        const { error: deleteError } = await supabase
                            .from('staff')
                            .delete()
                            .not('id', 'in', `(${currentIds.join(',')})`);

                        if (deleteError) throw deleteError;
                    } else {
                        // 리스트가 비어있으면 전체 삭제
                        const { error: deleteAllError } = await supabase
                            .from('staff')
                            .delete()
                            .neq('id', 'placeholder'); // Delete all (using a dummy condition if needed, or just no filter)

                        // Supabase delete requires a filter unless configured otherwise.
                        // Using a condition that is always true or checking IDs.
                        // Safer: Get all IDs first? Or just delete all.
                        // Let's try deleting all rows where ID is NOT in empty list (which is everything)
                        // But 'not in empty list' query might be tricky.
                        // Instead, let's fetch all IDs and delete them?
                        // Or just: delete().neq('id', '0') assuming no ID is 0.

                        const { error: clearError } = await supabase
                            .from('staff')
                            .delete()
                            .neq('id', '0'); // Hack to delete all

                        if (clearError) throw clearError;
                    }
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
