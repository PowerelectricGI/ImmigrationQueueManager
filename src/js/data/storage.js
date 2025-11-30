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
            if (key === STORAGE_KEYS.STAFF) {
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
                    // 'not.in' filter can be brittle. Instead, we fetch remote IDs and delete the diff.
                    const { data: remoteStaff, error: fetchError } = await supabase
                        .from('staff')
                        .select('id');

                    if (fetchError) throw fetchError;

                    const remoteIds = remoteStaff.map(r => r.id);
                    const localIds = data.map(s => s.id);

                    // Find IDs that are in DB but not in our new list
                    const idsToDelete = remoteIds.filter(id => !localIds.includes(id));

                    if (idsToDelete.length > 0) {
                        const { error: deleteError } = await supabase
                            .from('staff')
                            .delete()
                            .in('id', idsToDelete);

                        if (deleteError) throw deleteError;
                    }
                }
            } else if (key === STORAGE_KEYS.SETTINGS) {
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
            alert(`클라우드 저장 실패: ${error.message || JSON.stringify(error)}`);
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
            if (key === STORAGE_KEYS.STAFF) {
                const { data, error } = await supabase.from('staff').select('*');
                if (error) throw error;
                return data;
            } else if (key === STORAGE_KEYS.SETTINGS) {
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
     * @param {Function} onStatusChange 
     */
    subscribe(onStaffChange, onSettingsChange, onStatusChange) {
        const channel = supabase.channel('schema-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'staff' },
                (payload) => {
                    console.log('Staff change received:', payload);
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
            .subscribe((status) => {
                console.log('Supabase Subscription Status:', status);
                if (onStatusChange) onStatusChange(status);
            });

        // Connection Timeout Check
        setTimeout(() => {
            console.log('Checking subscription connection...');
        }, 5000);

        return channel;
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    has(key) {
        return localStorage.getItem(key) !== null;
    }
};
