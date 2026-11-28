import { Component, computed, input } from '@angular/core';
import { Tool } from '../core/tool.service';

@Component({
  selector: 'app-tool-list',
  template: `
    <div style="margin-top: 16px">
      @for (group of groups(); track group.category) {
        <div style="margin-bottom: 24px">
          <h3 style="text-transform: capitalize; margin-bottom: 12px">{{ group.category }}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px">
            @for (tool of group.tools; track tool.name) {
              <div class="card">
                <h4>{{ tool.name }}</h4>
                <p style="color: var(--color-text-muted); font-size: 13px; margin-top: 8px">{{ tool.description }}</p>
              </div>
            }
          </div>
        </div>
      }
      @if (tools().length === 0) {
        <p>No tools available</p>
      }
    </div>
  `,
})
export class ToolList {
  readonly tools = input<Tool[]>([]);

  protected readonly groups = computed(() => {
    const map = new Map<string, Tool[]>();
    for (const tool of this.tools()) {
      const category = tool.name?.split('_')[0] || 'other';
      map.set(category, [...(map.get(category) ?? []), tool]);
    }
    return [...map].map(([category, tools]) => ({ category, tools }));
  });
}
