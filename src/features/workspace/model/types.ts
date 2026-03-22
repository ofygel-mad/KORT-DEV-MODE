export type WorkspaceWidgetKind = 'customers' | 'deals' | 'tasks' | 'reports' | 'imports' | 'chapan' | 'requests';
export type WorkspaceSceneTheme = 'default' | 'morning' | 'overcast' | 'dusk' | 'night';
export type WorkspaceSceneMode = 'surface' | 'flight';
export type WorkspaceSceneTerrainMode = 'full' | 'calm' | 'void';
export type WorkspaceTileDistance = 'near' | 'mid' | 'far';

export interface WorkspaceViewport {
  x: number;
  y: number;
}

export type WorkspaceModalSize = 'compact' | 'default' | 'wide';
export type WorkspaceTileStatus = 'floating' | 'drifting' | 'idle';

export interface WorkspaceEuler3D {
  x: number;
  y: number;
  z: number;
}

export interface WorkspaceTile {
  id: string;
  kind: WorkspaceWidgetKind;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  modalSize: WorkspaceModalSize;
  version: number;
  createdAt: string;
  lastInteractionAt: string;
  status: WorkspaceTileStatus;
  rotation3D: WorkspaceEuler3D;
  distance3D: WorkspaceTileDistance;
  pinned?: boolean;
  zIndex?: number;
}

export interface FabPosition {
  x: number;
  y: number;
}

export interface WorkspaceSnapshot {
  customersCount: number;
  dealsCount: number;
  tasksCount: number;
  revenueMonth: number;
  recentCustomers: Array<{
    id: string;
    fullName: string;
    companyName: string;
    status: string;
  }>;
  stalledDeals: Array<{
    id: string;
    title: string;
    customerName: string;
    stage: string;
    amount: number;
    daysSilent: number | null;
  }>;
  todayTasks: Array<{
    id: string;
    title: string;
    priority: string;
    customerName: string | null;
    dueAt: string | null;
  }>;
}
