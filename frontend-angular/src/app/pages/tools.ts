import { Component, OnInit, inject, signal } from '@angular/core';
import { ToolList } from '../components/tool-list';
import { Tool, ToolService } from '../core/tool.service';

@Component({
  selector: 'app-tools-page',
  imports: [ToolList],
  template: `
    <h1>Available Tools</h1>
    <app-tool-list [tools]="tools()" />
  `,
})
export class ToolsPage implements OnInit {
  private readonly toolService = inject(ToolService);
  protected readonly tools = signal<Tool[]>([]);

  async ngOnInit() {
    try {
      this.tools.set(await this.toolService.list());
    } catch {
      /* leave empty */
    }
  }
}
