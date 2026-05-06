import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, Users, UserCog, Plus, Trash2, 
  Edit3, X, History, Building2, ArrowRight, RefreshCw, Briefcase, LayoutGrid, User
} from 'lucide-react';
import type { OrgUnit } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface OrgStructureProps {
  units: OrgUnit[];
  onUnitsChange: (units: OrgUnit[]) => void;
}

const normalizeBackendUnit = (backendUnit: any): OrgUnit => {
  if (!backendUnit) return backendUnit;
  
  const typeRaw = backendUnit.unit_type || backendUnit.type || 'group';
  const finalType = typeRaw === 'military_unit' ? 'unit' : typeRaw;

  const commanderRaw = backendUnit.commanderId !== undefined ? backendUnit.commanderId : backendUnit.commander;
  const finalCommanderId = commanderRaw ? (typeof commanderRaw === 'object' ? commanderRaw.id?.toString() : commanderRaw.toString()) : null;

  const parentRaw = backendUnit.parentId !== undefined ? backendUnit.parentId : backendUnit.parent;
  const finalParentId = parentRaw ? (typeof parentRaw === 'object' ? parentRaw.id?.toString() : parentRaw.toString()) : null;

  const personnelList = Array.isArray(backendUnit.personnel_list) 
    ? backendUnit.personnel_list 
    : (Array.isArray(backendUnit.personnelList) ? backendUnit.personnelList : []);

  return {
    id: backendUnit.id?.toString(),
    name: backendUnit.name || 'Без названия',
    parentId: finalParentId,
    commanderId: finalCommanderId,
    type: finalType,
    children: Array.isArray(backendUnit.children) ? backendUnit.children.map(normalizeBackendUnit) : [],
    commanderDetail: backendUnit.commander_detail || backendUnit.commanderDetail,
    personnelList: personnelList,
  };
};

const toBackendType = (type: OrgUnit['type']): string => 
  type === 'unit' ? 'military_unit' : type;

const getSafeUnitId = (userObj: any): string | null => {
  if (!userObj || !userObj.org_unit) return null;
  return typeof userObj.org_unit === 'object' ? userObj.org_unit.id?.toString() : userObj.org_unit.toString();
};

const getUnitPath = (unitId: string | null, allUnits: OrgUnit[]): string => {
  if (!unitId) return 'Не привязан';
  let currentUnit = allUnits.find(u => u.id === unitId);
  if (!currentUnit) return 'Не привязан';

  const path: string[] = [];
  const visited = new Set<string>();

  while (currentUnit && !visited.has(currentUnit.id)) {
    visited.add(currentUnit.id);
    path.unshift(currentUnit.name);
    currentUnit = allUnits.find(u => u.id === currentUnit!.parentId);
  }

  return path.join(' / ');
};

export function OrgStructure({ units = [], onUnitsChange }: OrgStructureProps) {
  const { user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState<OrgUnit | null>(null);
  const [structureHistory, setStructureHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const safeUnits = useMemo(() => {
    if (!Array.isArray(units)) return [];
    return units.map(normalizeBackendUnit);
  }, [units]);

  const loadUsers = useCallback(async () => {
    try {
      let page = 1;
      let allUsers: any[] = [];
      let hasNext = true;
      
      while (hasNext) {
        const response = await api.request(`/users/?page=${page}`).catch(() => null);
        if (!response) break;
        
        if (Array.isArray(response)) {
          allUsers = response;
          break;
        } else if (response.results) {
          allUsers = [...allUsers, ...response.results];
          hasNext = !!response.next;
          page++;
        } else {
          break;
        }
      }
      if (allUsers.length > 0) setUsers(allUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const historyData = await api.getStructureHistory();
      const flatHistory = Array.isArray(historyData) ? historyData : (historyData?.results || []);
      setStructureHistory(flatHistory);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }, []);

  const loadTree = useCallback(async () => {
    try {
      const treeData = await api.getOrgTree();
      let rawArray: any[] = [];
      
      if (Array.isArray(treeData)) {
        rawArray = treeData;
      } else if (treeData && Array.isArray(treeData.results)) {
        rawArray = treeData.results;
      } else if (treeData && Array.isArray(treeData.data)) {
        rawArray = treeData.data;
      }

      if (rawArray.length === 0 && safeUnits.length > 0) {
        return;
      }

      const normalized = rawArray.map(normalizeBackendUnit);
      onUnitsChange(normalized);
    } catch (error) {
      console.error('Failed to load tree:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    Promise.all([loadTree(), loadUsers(), loadHistory()]).finally(() => setInitialLoading(false));
  }, [loadTree, loadUsers, loadHistory]);

  const canEdit = user?.role === 'commander' || user?.role === 'deputy_commander';

  const flattenUnits = (nodes: OrgUnit[]): OrgUnit[] => {
    let all: OrgUnit[] = [];
    for (const n of nodes) {
      all.push(n);
      if (n.children && n.children.length) {
        all = all.concat(flattenUnits(n.children));
      }
    }
    return all;
  };

  const allUnits = flattenUnits(safeUnits);
  const totalUnits = allUnits.length;
  const departmentsCount = allUnits.filter(u => u.type === 'department').length;
  const groupsCount = allUnits.filter(u => u.type === 'group').length;

  const handleAddUnit = async (name: string, type: OrgUnit['type'], commanderId: string | null, parentId: string | null) => {
    if (!canEdit) return;
    setLoading(true);
    try {
      await api.createUnit({
        name,
        unit_type: toBackendType(type),
        parent: parentId ? parseInt(parentId) : null,
        commander: commanderId ? parseInt(commanderId) : null,
        order: 0,
      });
      await loadTree();
      await loadHistory();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to create unit:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!canEdit) return;
    const hasChildren = safeUnits.some(u => u.parentId === id);
    if (hasChildren) {
      alert('Нельзя удалить подразделение с дочерними элементами');
      return;
    }
    if (!confirm('Вы уверены, что хотите удалить это подразделение?')) return;
    setLoading(true);
    try {
      await api.deleteUnit(parseInt(id));
      await loadTree();
      await loadHistory();
    } catch (error) {
      console.error('Failed to delete unit:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUnit = async (updated: OrgUnit) => {
    if (!canEdit) return;
    setLoading(true);
    try {
      await api.updateUnit(parseInt(updated.id), {
        name: updated.name,
        unit_type: toBackendType(updated.type),
        commander: updated.commanderId ? parseInt(updated.commanderId) : null,
      });
      await loadTree();
      await loadHistory();
      setEditingUnit(null);
    } catch (error) {
      console.error('Failed to update unit:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMovePersonnelBulk = async (userIds: string[], targetUnitId: string) => {
    if (!canEdit) return;
    try {
      await Promise.all(userIds.map(id => api.movePersonnel(parseInt(id), parseInt(targetUnitId))));
      await Promise.all([loadUsers(), loadTree(), loadHistory()]);
    } catch (error: any) {
      console.error('Failed to move personnel:', error);
      alert(`Ошибка сервера при перемещении: ${error.message}`);
      throw error;
    }
  };

  const handleRemovePersonnel = async (userId: string) => {
    if (!canEdit) return;
    if (!confirm('Исключить сотрудника из текущего подразделения?')) return;
    setLoading(true);
    try {
      await api.movePersonnel(parseInt(userId), null);
      await Promise.all([loadUsers(), loadTree(), loadHistory()]);
    } catch (error: any) {
      console.error('Failed to remove personnel:', error);
      alert(`Ошибка сервера при удалении: ${error.message || 'Смотрите консоль'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    Promise.all([loadTree(), loadUsers(), loadHistory()]).finally(() => setLoading(false));
  };

  if (initialLoading) {
    return <div className="text-center py-8 text-slate-500">Загрузка структуры...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Организационная структура</h1>
          <p className="text-sm text-slate-500 mt-1">Управление подразделениями и личным составом</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded transition-colors',
              showHistory ? 'border-slate-800 text-slate-800 bg-slate-100' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            )}
          >
            <History size={16} />
            История
          </button>
          <div title="Обновить">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Обновить
            </button>
          </div>
          {canEdit && (
            <button
              onClick={() => { setAddParentId(null); setShowAddModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              <Plus size={16} />
              Добавить
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-2 text-sm text-slate-500">Синхронизация данных...</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree View */}
        <div className="lg:col-span-2 bg-white rounded-md border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-slate-500" />
            Дерево подразделений
          </h3>
          <div className="space-y-2">
            {safeUnits && safeUnits.length > 0 ? (
              safeUnits.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  users={users}
                  allUnits={allUnits}
                  canEdit={canEdit}
                  onAddChild={(parentId) => { setAddParentId(parentId); setShowAddModal(true); }}
                  onDelete={handleDeleteUnit}
                  onEdit={setEditingUnit}
                  onMovePersonnelBulk={handleMovePersonnelBulk}
                  onRemovePersonnel={handleRemovePersonnel}
                />
              ))
            ) : (
              <div className="text-center py-8 text-sm text-slate-500 border border-dashed border-slate-300 rounded">
                Нет подразделений. Создайте первое подразделение.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Статистика</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Всего подразделений</span>
                <span className="font-medium text-slate-900">{totalUnits}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Отделов</span>
                <span className="font-medium text-slate-900">{departmentsCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Групп</span>
                <span className="font-medium text-slate-900">{groupsCount}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-100 pt-3">
                <span className="text-slate-600 font-medium">Личный состав</span>
                <span className="font-medium text-slate-900">{users.length} чел.</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm flex flex-col max-h-[600px]">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 flex-shrink-0">
              <Users size={18} className="text-slate-500" />
              Общий список личного состава
            </h3>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {users.length > 0 ? (
                users.map(u => {
                  const uUnitId = getSafeUnitId(u);
                  const commandedUnit = allUnits.find(ou => ou.commanderId === u.id.toString());
                  const isCommander = !!commandedUnit;
                  const targetUnitId = commandedUnit ? commandedUnit.id : uUnitId;
                  const hierarchyPath = getUnitPath(targetUnitId, allUnits);

                  return (
                    <div key={u.id} className="flex items-start p-2 rounded border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 truncate" title={`${translateRank(u.rank)} ${u.full_name}`}>
                          {translateRank(u.rank)} {u.full_name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          {isCommander && (
                            <span title="Командир" className="flex-shrink-0 flex items-center justify-center">
                              <UserCog size={14} className="text-blue-600" />
                            </span>
                          )}
                          <span className="truncate" title={hierarchyPath}>{hierarchyPath}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-sm text-slate-500">Нет пользователей</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {showHistory && (
        <div className="bg-white rounded-md border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <History size={18} className="text-slate-500" />
            История изменений
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {structureHistory.length > 0 ? (
              structureHistory.map((h: any) => {
                const userObj = users.find(u => u.id === h.changed_by);
                return (
                  <div key={h.id} className="flex items-start gap-3 p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{h.change_type_display || h.change_type}</div>
                      <div className="text-sm text-slate-600 mt-1">{h.description}</div>
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                        <span>{new Date(h.created_at).toLocaleString('ru-RU')}</span>
                        <span>|</span>
                        <span>{userObj ? `${translateRank(userObj.rank)} ${userObj.full_name}` : 'Система'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-sm text-slate-500">История изменений пуста</div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddUnitModal
          parentId={addParentId}
          units={safeUnits}
          users={users}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddUnit}
        />
      )}
      {editingUnit && (
        <EditUnitModal
          unit={editingUnit}
          users={users}
          onClose={() => setEditingUnit(null)}
          onSave={handleUpdateUnit}
        />
      )}
    </div>
  );
}

// ========== TreeNode ==========
function TreeNode({ node, depth, users, allUnits, canEdit, onAddChild, onDelete, onEdit, onMovePersonnelBulk, onRemovePersonnel }: {
  node: OrgUnit & { children?: OrgUnit[] };
  depth: number;
  users: any[];
  allUnits: OrgUnit[];
  canEdit: boolean;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onEdit: (unit: OrgUnit) => void;
  onMovePersonnelBulk: (userIds: string[], targetUnitId: string) => Promise<void>;
  onRemovePersonnel: (userId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showPersonnelModal, setShowPersonnelModal] = useState(false);
  
  const commander = users.find(u => u.id.toString() === node.commanderId?.toString());
  
  const mergedUsersMap = new Map();
  (node.personnelList || []).forEach(u => {
    if (u && u.id) mergedUsersMap.set(u.id.toString(), u);
  });
  users.forEach(u => {
    if (u && u.id && getSafeUnitId(u) === node.id.toString()) {
      mergedUsersMap.set(u.id.toString(), u);
    }
  });
  
  if (node.commanderId) mergedUsersMap.delete(node.commanderId.toString());
  
  const unitUsers = Array.from(mergedUsersMap.values());
  const hasChildren = node.children && node.children.length > 0;
  const hasExpandableContent = hasChildren || unitUsers.length > 0;

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'unit':
      case 'military_unit': return <Building2 size={16} className="text-slate-600" />;
      case 'department': return <Briefcase size={16} className="text-slate-600" />;
      case 'group': return <LayoutGrid size={16} className="text-slate-600" />;
      default: return <Building2 size={16} className="text-slate-600" />;
    }
  };

  const typeBg: Record<string, string> = {
    unit: 'bg-red-50 border-red-200', military_unit: 'bg-red-50 border-red-200',
    department: 'bg-blue-50 border-blue-200',
    group: 'bg-green-50 border-green-200',
  };

  return (
    <div className={depth > 0 ? "pl-5 border-l border-slate-200 ml-2 mt-2" : "mt-2"}>
      <div className={cn('flex items-center gap-3 p-3 rounded-md border mb-1 group shadow-sm transition-colors', typeBg[node.type] || 'bg-slate-50 border-slate-200 hover:border-blue-300')}>
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="text-slate-400 hover:text-slate-800 w-5 flex justify-center transition-colors"
        >
          {hasExpandableContent ? (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="w-4 inline-block" />}
        </button>
        
        <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 border border-slate-200">
          {getTypeIcon(node.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900">{node.name}</div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {commander ? (
              <div className="flex items-center gap-1.5" title="Командир">
                <UserCog size={14} className="text-blue-600" />
                <span className="truncate">{translateRank(commander.rank)} {commander.full_name}</span>
              </div>
            ) : (
              <div className="text-slate-400 italic">Командир не назначен</div>
            )}
            
            {unitUsers.length > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5" title="Личный состав">
                  <Users size={14} className="text-slate-400" />
                  <span>{unitUsers.length} чел.</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span title="Управление составом">
              <button onClick={() => setShowPersonnelModal(true)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"><Users size={16} /></button>
            </span>
            <span title="Добавить подразделение">
              <button onClick={() => onAddChild(node.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"><Plus size={16} /></button>
            </span>
            <span title="Редактировать">
              <button onClick={() => onEdit(node)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"><Edit3 size={16} /></button>
            </span>
            {node.type !== 'unit' && (
              <span title="Удалить">
                <button onClick={() => onDelete(node.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
              </span>
            )}
          </div>
        )}
      </div>
      
      {showPersonnelModal && (
        <ManagePersonnelModal
          unitId={node.id}
          unitName={node.name}
          unitUsers={unitUsers}
          allUsers={users}
          onClose={() => setShowPersonnelModal(false)}
          onMovePersonnelBulk={onMovePersonnelBulk}
          onRemovePersonnel={onRemovePersonnel}
        />
      )}
      
      {expanded && hasExpandableContent && (
        <div className="mt-2 mb-3">
          {unitUsers.length > 0 && (
            <div className="pl-6 py-2 mb-3 space-y-2 border-l border-slate-200 ml-2">
              {unitUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between text-sm text-slate-700 bg-slate-50/50 p-1.5 rounded border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <User size={14} className="text-slate-400" />
                    <span>{translateRank(u.rank)} {u.full_name}</span>
                  </div>
                  {canEdit && (
                    <span title="Исключить из подразделения">
                      <button 
                        onClick={() => onRemovePersonnel(u.id.toString())}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-200 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {hasChildren && (
            <div>
              {node.children!.map(child => (
                <TreeNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  users={users}
                  allUnits={allUnits}
                  canEdit={canEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onMovePersonnelBulk={onMovePersonnelBulk}
                  onRemovePersonnel={onRemovePersonnel}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== ManagePersonnelModal ==========
function ManagePersonnelModal({ unitId, unitName, unitUsers, allUsers, onClose, onMovePersonnelBulk, onRemovePersonnel }: {
  unitId: string; unitName: string; unitUsers: any[]; allUsers: any[]; onClose: () => void; onMovePersonnelBulk: (userIds: string[], targetUnitId: string) => Promise<void>; onRemovePersonnel: (userId: string) => Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const unitUserIds = new Set(unitUsers.map(u => u.id.toString()));
  const availableUsers = allUsers.filter(u => {
    const uUnitId = getSafeUnitId(u);
    return !unitUserIds.has(u.id.toString()) && uUnitId !== unitId.toString();
  });
  
  const filteredUsers = availableUsers.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || translateRank(u.rank).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsAdding(true);
    try {
      await onMovePersonnelBulk(Array.from(selectedIds), unitId);
      onClose();
    } catch (error) {
      console.error('Ошибка при добавлении:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Управление личным составом</h2>
            <p className="text-sm text-slate-500 mt-1">Подразделение: <span className="font-medium text-slate-800">{unitName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"><X size={20} /></button>
        </div>
        
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <div className="flex-1 border-r border-slate-200 flex flex-col min-h-0 bg-slate-50/50">
            <div className="p-4 border-b border-slate-200 flex-shrink-0">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Текущий состав ({unitUsers.length})</h3>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
              {unitUsers.length > 0 ? (
                unitUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded shadow-sm">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-sm font-medium text-slate-800 truncate">{u.full_name}</div>
                      <div className="text-xs text-slate-500">{translateRank(u.rank)}</div>
                    </div>
                    <span title="Исключить из подразделения">
                      <button 
                        onClick={() => onRemovePersonnel(u.id.toString())}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Нет сотрудников</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="p-4 border-b border-slate-200 flex-shrink-0 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Добавить сотрудников</h3>
              <input
                type="text"
                placeholder="Поиск по ФИО или званию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
            
            <div className="p-4 overflow-y-auto space-y-2 flex-1 custom-scrollbar">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(u => {
                  const isSelected = selectedIds.has(u.id.toString());
                  return (
                    <label 
                      key={u.id} 
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-all",
                        isSelected ? "bg-blue-50 border-blue-300 shadow-sm" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleUser(u.id.toString())}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{u.full_name}</div>
                        <div className="text-xs text-slate-500">{translateRank(u.rank)}</div>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">Сотрудники не найдены</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
              <button
                onClick={handleAddSelected}
                disabled={selectedIds.size === 0 || isAdding}
                className="w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isAdding ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                Добавить выбранных {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== AddUnitModal ==========
function AddUnitModal({ parentId, units, users, onClose, onAdd }: any) {
  const [name, setName] = useState('');
  const [type, setType] = useState<OrgUnit['type']>('group');
  const [commanderId, setCommanderId] = useState('');
  const parentUnit = parentId ? units.find((u: any) => u.id === parentId) : null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800">Добавить подразделение</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"><X size={20} /></button>
          </div>
          {parentUnit && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 flex items-center gap-2">
              <ArrowRight size={14} className="text-slate-400" /> Родительское: <strong>{parentUnit.name}</strong>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Название</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Введите название" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Тип</label>
              <select value={type} onChange={e => setType(e.target.value as OrgUnit['type'])} className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                <option value="unit">Часть</option>
                <option value="department">Отдел</option>
                <option value="group">Группа</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Командир</label>
              <select value={commanderId} onChange={e => setCommanderId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                <option value="">Не назначен</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{translateRank(u.rank)} {u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors">Отмена</button>
            <button onClick={() => { if (name.trim()) onAdd(name, type, commanderId || null, parentId); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm">
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== EditUnitModal ==========
function EditUnitModal({ unit, users, onClose, onSave }: any) {
  const [name, setName] = useState(unit.name);
  const [commanderId, setCommanderId] = useState(unit.commanderId || '');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-800">Редактирование</h2>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"><X size={20} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Название</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Командир</label>
              <select value={commanderId} onChange={e => setCommanderId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                <option value="">Не назначен</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{translateRank(u.rank)} {u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors">Отмена</button>
            <button onClick={() => onSave({ ...unit, name, commanderId: commanderId || null })} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm">
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Translation ==========
const RANK_TRANSLATIONS: Record<string, string> = {
  private: 'рядовой', corporal: 'ефрейтор', sergeant: 'сержант', staff_sergeant: 'старшина',
  warrant_officer: 'прапорщик', lieutenant: 'лейтенант', sr_lieutenant: 'ст. лейтенант',
  captain: 'капитан', major: 'майор', lt_colonel: 'подполковник', colonel: 'полковник',
};
const RANK_ABBREVIATIONS: Record<string, string> = {
  private: 'ряд.', corporal: 'ефр.', sergeant: 'с-т', staff_sergeant: 'ст-на',
  warrant_officer: 'пр-к', lieutenant: 'л-т', sr_lieutenant: 'ст. л-т',
  captain: 'к-н', major: 'м-р', lt_colonel: 'п/п-к', colonel: 'п-к',
};
function translateRank(rank: string): string {
  if (!rank) return '';
  return `${RANK_TRANSLATIONS[rank] || rank} (${RANK_ABBREVIATIONS[rank] || rank})`;
}