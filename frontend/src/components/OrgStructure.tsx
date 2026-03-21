import { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, Users, UserCog, Plus, Trash2, 
  Edit3, X, History, Building2, ArrowRight
} from 'lucide-react';
import type { OrgUnit } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface OrgStructureProps {
  units: OrgUnit[];
  onUnitsChange: (units: OrgUnit[]) => void;
}

export function OrgStructure({ units, onUnitsChange }: OrgStructureProps) {
  const { user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState<OrgUnit | null>(null);
  const [structureHistory, setStructureHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Загрузка пользователей и истории
  useEffect(() => {
    Promise.all([loadUsers(), loadHistory()]).finally(() => setInitialLoading(false));
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await api.getUsers();
      
      if (Array.isArray(usersData)) {
        setUsers(usersData);
      } else if (usersData?.results && Array.isArray(usersData.results)) {
        setUsers(usersData.results);
      } else {
        console.error('Unexpected users data format:', usersData);
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    }
  };

  const loadHistory = async () => {
    try {
      const historyData = await api.getStructureHistory();
      
      if (Array.isArray(historyData)) {
        setStructureHistory(historyData);
      } else if (historyData?.results && Array.isArray(historyData.results)) {
        setStructureHistory(historyData.results);
      } else {
        setStructureHistory([]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      setStructureHistory([]);
    }
  };

  // Проверка прав на редактирование
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

  const allUnits = flattenUnits(units);

  const handleAddUnit = async (name: string, type: OrgUnit['type'], commanderId: string | null, parentId: string | null) => {
    if (!canEdit) {
      alert('У вас нет прав для создания подразделений');
      return;
    }
    
    setLoading(true);
    try {
      const newUnit = await api.createUnit({
        name,
        unit_type: type,
        parent: parentId ? parseInt(parentId) : null,
        commander: commanderId ? parseInt(commanderId) : null,
        order: 0
      });
      
      const transformedUnit: OrgUnit = {
        id: newUnit.id.toString(),
        name: newUnit.name,
        parentId: newUnit.parent?.toString() || null,
        commanderId: newUnit.commander?.toString() || null,
        type: newUnit.unit_type,
      };
      
      onUnitsChange([...units, transformedUnit]);
      await loadHistory();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to create unit:', error);
      alert('Ошибка при создании подразделения');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!canEdit) {
      alert('У вас нет прав для удаления подразделений');
      return;
    }

    const hasChildren = units.some(u => u.parentId === id);
    if (hasChildren) {
      alert('Нельзя удалить подразделение с дочерними элементами');
      return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить это подразделение?')) return;
    
    setLoading(true);
    try {
      await api.deleteUnit(parseInt(id));
      onUnitsChange(units.filter(u => u.id !== id));
      await loadHistory();
    } catch (error) {
      console.error('Failed to delete unit:', error);
      alert('Ошибка при удалении подразделения');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUnit = async (updated: OrgUnit) => {
    if (!canEdit) {
      alert('У вас нет прав для редактирования подразделений');
      return;
    }

    setLoading(true);
    try {
      await api.updateUnit(parseInt(updated.id), {
        name: updated.name,
        unit_type: updated.type,
        commander: updated.commanderId ? parseInt(updated.commanderId) : null,
      });
      
      onUnitsChange(units.map(u => u.id === updated.id ? updated : u));
      await loadHistory();
      setEditingUnit(null);
    } catch (error) {
      console.error('Failed to update unit:', error);
      alert('Ошибка при обновлении подразделения');
    } finally {
      setLoading(false);
    }
  };

  const handleMovePersonnel = async (userId: string, targetUnitId: string) => {
    if (!canEdit) {
      alert('У вас нет прав для перемещения личного состава');
      return;
    }

    setLoading(true);
    try {
      await api.movePersonnel(parseInt(userId), parseInt(targetUnitId));
      await loadUsers();
      await loadHistory();
      alert('Пользователь успешно перемещен');
    } catch (error) {
      console.error('Failed to move personnel:', error);
      alert('Ошибка при перемещении пользователя');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="text-center py-8">Загрузка структуры...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Структура подразделений</h1>
          <p className="text-sm text-slate-500 mt-1">Конструктор организационной иерархии</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors',
              showHistory ? 'border-green-700 text-green-700 bg-green-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}
          >
            <History size={14} />
            История изменений
          </button>
          {canEdit && (
            <button
              onClick={() => { setAddParentId(null); setShowAddModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800"
              disabled={loading}
            >
              <Plus size={14} />
              Добавить
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-4 text-slate-500">Загрузка...</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tree View */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-green-700" />
            Дерево подразделений
          </h3>
          <div className="space-y-1">
            {units.length > 0 ? (
              units.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  users={users}
                  canEdit={canEdit}
                  onAddChild={(parentId) => { setAddParentId(parentId); setShowAddModal(true); }}
                  onDelete={handleDeleteUnit}
                  onEdit={setEditingUnit}
                  onMovePersonnel={handleMovePersonnel}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                Нет подразделений. Создайте первое подразделение.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Статистика структуры</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Всего подразделений</span>
                <span className="font-medium text-slate-800">{allUnits.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Отделов</span>
                <span className="font-medium text-slate-800">{allUnits.filter(u => u.type === 'department').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Групп</span>
                <span className="font-medium text-slate-800">{allUnits.filter(u => u.type === 'group').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Личный состав</span>
                <span className="font-medium text-slate-800">{users.length} чел.</span>
              </div>
            </div>
          </div>

          {/* Personnel list */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Users size={14} className="text-blue-500" />
              Личный состав
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.length > 0 ? (
                users.map(u => {
                  const unit = allUnits.find(ou => ou.id === u.org_unit?.toString());
                  const isCommander = allUnits.some(ou => ou.commanderId === u.id.toString());
                  return (
                    <div key={u.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-50">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                        style={{ backgroundColor: `hsl(${u.id * 100 % 360}, 70%, 50%)` }}
                      >
                        {u.full_name?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-slate-700 truncate">
                          {translateRank(u.rank)} {u.full_name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          {isCommander && <UserCog size={9} className="text-amber-500" />}
                          {unit?.name || '—'}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-slate-400">Нет пользователей</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <History size={16} className="text-blue-500" />
            История изменений структуры
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {structureHistory.length > 0 ? (
              structureHistory.map((h: any) => {
                const user = users.find(u => u.id === h.changed_by);
                return (
                  <div key={h.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 border-l-2 border-blue-300">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-700">{h.change_type_display || h.change_type}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{h.description}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{new Date(h.created_at).toLocaleString('ru-RU')}</span>
                        <span>•</span>
                        <span>{user ? `${translateRank(user.rank)} ${user.full_name}` : 'Система'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-slate-400">История изменений пуста</div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddUnitModal
          parentId={addParentId}
          units={units}
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

// ========== TreeNode Component ==========
function TreeNode({ node, depth, users, canEdit, onAddChild, onDelete, onEdit, onMovePersonnel }: {
  node: OrgUnit & { children?: OrgUnit[] };
  depth: number;
  users: any[];
  canEdit: boolean;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onEdit: (unit: OrgUnit) => void;
  onMovePersonnel: (userId: string, targetUnitId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const commander = users.find(u => u.id.toString() === node.commanderId);
  const unitUsers = users.filter(u => u.org_unit?.toString() === node.id && u.id.toString() !== node.commanderId);
  const hasChildren = node.children && node.children.length > 0;

  const typeIcons: Record<string, string> = {
    unit: '🏛️',
    department: '🏢',
    group: '👥',
  };

  const typeBg: Record<string, string> = {
    unit: 'bg-red-50 border-red-200',
    department: 'bg-blue-50 border-blue-200',
    group: 'bg-green-50 border-green-200',
  };

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div className={cn('flex items-center gap-2 p-2.5 rounded-lg border mb-1 group', typeBg[node.type])}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-400 hover:text-slate-600 w-4"
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5 inline-block" />}
        </button>
        <span className="text-sm">{typeIcons[node.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800">{node.name}</div>
          {commander && (
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
              <UserCog size={10} className="text-amber-500" />
              {translateRank(commander.rank)} {commander.full_name}
            </div>
          )}
          {unitUsers.length > 0 && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              Л/С: {unitUsers.length} чел.
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowMoveModal(true)}
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded"
              title="Переместить личный состав"
            >
              <Users size={14} />
            </button>
            <button
              onClick={() => onAddChild(node.id)}
              className="p-1 text-slate-400 hover:text-green-700 hover:bg-white rounded"
              title="Добавить дочернее"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => onEdit(node)}
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded"
              title="Редактировать"
            >
              <Edit3 size={14} />
            </button>
            {node.type !== 'unit' && (
              <button
                onClick={() => onDelete(node.id)}
                className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded"
                title="Удалить"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      
      {showMoveModal && (
        <MovePersonnelModal
          unitId={node.id}
          unitName={node.name}
          users={unitUsers}
          onClose={() => setShowMoveModal(false)}
          onMove={onMovePersonnel}
        />
      )}
      
      {expanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child as OrgUnit & { children?: OrgUnit[] }}
              depth={depth + 1}
              users={users}
              canEdit={canEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onEdit={onEdit}
              onMovePersonnel={onMovePersonnel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== MovePersonnelModal Component ==========
function MovePersonnelModal({ unitId, unitName, users, onClose, onMove }: {
  unitId: string;
  unitName: string;
  users: any[];
  onClose: () => void;
  onMove: (userId: string, targetUnitId: string) => void;
}) {
  const [selectedUser, setSelectedUser] = useState('');
  const [targetUnitId, setTargetUnitId] = useState('');

  const handleMove = () => {
    if (selectedUser && targetUnitId) {
      onMove(selectedUser, targetUnitId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800">Переместить личный состав</h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Подразделение: <strong>{unitName}</strong>
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Сотрудник</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
              >
                <option value="">Выберите сотрудника</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {translateRank(u.rank)} {u.full_name}
                  </option>
                ))}
              </select>
              {users.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">В этом подразделении нет сотрудников</p>
              )}
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">ID целевого подразделения</label>
              <input
                type="text"
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                placeholder="Введите ID подразделения"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Отмена
            </button>
            <button
              onClick={handleMove}
              disabled={!selectedUser || !targetUnitId}
              className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Переместить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== AddUnitModal Component ==========
function AddUnitModal({ parentId, units, users, onClose, onAdd }: {
  parentId: string | null;
  units: OrgUnit[];
  users: any[];
  onClose: () => void;
  onAdd: (name: string, type: OrgUnit['type'], commanderId: string | null, parentId: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<OrgUnit['type']>('group');
  const [commanderId, setCommanderId] = useState('');

  const parentUnit = parentId ? units.find(u => u.id === parentId) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800">Добавить подразделение</h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          {parentUnit && (
            <div className="mb-4 p-2 bg-slate-50 rounded-lg text-xs text-slate-600 flex items-center gap-2">
              <ArrowRight size={12} />
              Родительское: <strong>{parentUnit.name}</strong>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Название</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700"
                placeholder="Название подразделения" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Тип</label>
              <select value={type} onChange={e => setType(e.target.value as OrgUnit['type'])}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                <option value="department">Отдел</option>
                <option value="group">Группа</option>
                <option value="unit">Часть</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Командир</label>
              <select value={commanderId} onChange={e => setCommanderId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                <option value="">Не назначен</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{translateRank(u.rank)} {u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Отмена</button>
            <button
              onClick={() => { if (name.trim()) onAdd(name, type, commanderId || null, parentId); }}
              className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800"
            >
              Создать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== EditUnitModal Component ==========
function EditUnitModal({ unit, users, onClose, onSave }: {
  unit: OrgUnit;
  users: any[];
  onClose: () => void;
  onSave: (u: OrgUnit) => void;
}) {
  const [name, setName] = useState(unit.name);
  const [commanderId, setCommanderId] = useState(unit.commanderId || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800">Редактирование</h2>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Название</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30 focus:border-green-700" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Командир</label>
              <select value={commanderId} onChange={e => setCommanderId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30">
                <option value="">Не назначен</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{translateRank(u.rank)} {u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Отмена</button>
            <button
              onClick={() => onSave({ ...unit, name, commanderId: commanderId || null })}
              className="px-4 py-2 text-sm bg-green-700 text-white rounded-lg hover:bg-green-800"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Translation Utilities ==========
const RANK_TRANSLATIONS: Record<string, string> = {
  'private': 'рядовой',
  'corporal': 'ефрейтор',
  'sergeant': 'сержант',
  'staff_sergeant': 'старшина',
  'warrant_officer': 'прапорщик',
  'lieutenant': 'лейтенант',
  'sr_lieutenant': 'ст. лейтенант',
  'captain': 'капитан',
  'major': 'майор',
  'lt_colonel': 'подполковник',
  'colonel': 'полковник',
};

const RANK_ABBREVIATIONS: Record<string, string> = {
  'private': 'ряд.',
  'corporal': 'ефр.',
  'sergeant': 'с-т',
  'staff_sergeant': 'ст-на',
  'warrant_officer': 'пр-к',
  'lieutenant': 'л-т',
  'sr_lieutenant': 'ст. л-т',
  'captain': 'к-н',
  'major': 'м-р',
  'lt_colonel': 'п/п-к',
  'colonel': 'п-к',
};

export function translateRank(rank: string): string {
  if (!rank) return '';
  return `${RANK_TRANSLATIONS[rank] || rank} (${RANK_ABBREVIATIONS[rank] || rank})`;
}