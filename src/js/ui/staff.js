/**
 * src/js/ui/staff.js
 * 직원 관리 UI 및 로직
 */

import { generateUUID } from '../utils/helpers.js';

export class StaffUI {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.staffList = [];
    // this.container will be initialized in render()

    this.bindEvents();
    // Defer initial render to allow DOM to be ready if called immediately
    setTimeout(() => this.render(), 0);
  }

  setStaffList(list) {
    this.staffList = list || [];
    this.render();
  }

  bindEvents() {
    // Add Staff Button (Event delegation or direct bind if element exists)
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-add-staff') {
        this.handleAddStaff();
      }
      if (e.target.classList.contains('btn-delete-staff')) {
        const id = e.target.dataset.id;
        this.handleDeleteStaff(id);
      }
    });
  }

  handleAddStaff() {
    const nameInput = document.getElementById('new-staff-name');
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
      alert('이름을 입력해주세요.');
      return;
    }

    const newStaff = {
      id: generateUUID(),
      name: name,
      status: 'idle', // idle, assigned
      assignment: null // { type: 'arrival'|'departure', zone: 'A', booth: 1 }
    };

    this.staffList.push(newStaff);
    this.eventBus.emit('staff:updated', this.staffList);

    nameInput.value = '';
    this.render();
  }

  handleDeleteStaff(id) {
    if (!confirm('정말 이 직원을 삭제하시겠습니까?')) return;

    this.staffList = this.staffList.filter(s => s.id !== id);
    this.eventBus.emit('staff:updated', this.staffList);
    this.render();
  }

  render() {
    if (!this.container) {
      this.container = document.getElementById('view-staff');
    }
    if (!this.container) return;

    const idleCount = this.staffList.filter(s => s.status === 'idle').length;
    const assignedCount = this.staffList.filter(s => s.status === 'assigned').length;

    this.container.innerHTML = `
      <div class="staff-view-container" style="padding: var(--spacing-md);">
        <div class="staff-stats" style="display: flex; gap: 1rem; margin-bottom: 1rem;">
          <div class="stat-card" style="flex: 1; background: var(--color-bg-card); padding: 1rem; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 0.9rem; color: var(--color-text-secondary);">전체 직원</div>
            <div style="font-size: 1.5rem; font-weight: bold;">${this.staffList.length}</div>
          </div>
          <div class="stat-card" style="flex: 1; background: var(--color-bg-card); padding: 1rem; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 0.9rem; color: var(--color-text-secondary);">대기 중</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-success);">${idleCount}</div>
          </div>
          <div class="stat-card" style="flex: 1; background: var(--color-bg-card); padding: 1rem; border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: 0.9rem; color: var(--color-text-secondary);">배정됨</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--color-accent);">${assignedCount}</div>
          </div>
        </div>

        <div class="add-staff-form" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <input type="text" id="new-staff-name" placeholder="직원 이름 입력" style="flex: 1; padding: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--color-bg-input); color: var(--color-text-primary);">
          <button id="btn-add-staff" style="padding: 0 1.5rem; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); font-weight: bold;">추가</button>
        </div>

        <div class="staff-list" style="background: var(--color-bg-card); border-radius: var(--radius-md); overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: rgba(255,255,255,0.05); text-align: left;">
                <th style="padding: 1rem;">이름</th>
                <th style="padding: 1rem;">상태</th>
                <th style="padding: 1rem;">배정 현황</th>
                <th style="padding: 1rem; text-align: right;">관리</th>
              </tr>
            </thead>
            <tbody>
              ${this.staffList.length === 0 ? '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--color-text-muted);">등록된 직원이 없습니다.</td></tr>' : ''}
              ${this.staffList.map(staff => `
                <tr style="border-top: 1px solid var(--border-color);">
                  <td style="padding: 1rem; font-weight: 500;">${staff.name}</td>
                  <td style="padding: 1rem;">
                    <span style="padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.8rem; background: ${staff.status === 'idle' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'}; color: ${staff.status === 'idle' ? '#10b981' : '#3b82f6'};">
                      ${staff.status === 'idle' ? '대기' : '배정됨'}
                    </span>
                  </td>
                  <td style="padding: 1rem; font-size: 0.9rem; color: var(--color-text-secondary);">
                    ${staff.assignment ? `${staff.assignment.type === 'arrival' ? '입국' : '출국'} - ${staff.assignment.zone} (부스 ${staff.assignment.booth})` : '-'}
                  </td>
                  <td style="padding: 1rem; text-align: right;">
                    <button class="btn-delete-staff" data-id="${staff.id}" style="background: none; border: none; color: var(--color-danger); cursor: pointer;">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
