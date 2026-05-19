import { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, FileText, Download, Trash2, 
  X, File, FileArchive, FileSpreadsheet, FolderOpen, RefreshCw, Eye 
} from 'lucide-react';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface Document {
  id: number;
  title: string;
  description: string;
  category: string;
  file: string; // URL файла
  file_name: string;
  file_size: number;
  uploaded_by_name: string;
  created_at: string;
}

// ИСПРАВЛЕНИЕ: Добавлена категория "Планы"
const CATEGORIES = [
  { id: 'all', label: 'Все документы' },
  { id: 'plans', label: 'Планы' },
  { id: 'instructions', label: 'Инструкции' },
  { id: 'regulations', label: 'Регламенты' },
  { id: 'templates', label: 'Шаблоны' },
  { id: 'other', label: 'Разное' },
];

// Утилита для форматирования размера файла
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Подбор иконки по расширению
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext || '')) return <FileText size={18} className="text-red-500" />;
  if (['zip', 'rar', '7z'].includes(ext || '')) return <FileArchive size={18} className="text-amber-600" />;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <FileSpreadsheet size={18} className="text-green-600" />;
  return <File size={18} className="text-blue-500" />;
};

export function KnowledgeBase() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [activeCategory, search]);

  const loadDocuments = async () => {
    try {
      const params: Record<string, string> = {};
      if (activeCategory !== 'all') params.category = activeCategory;
      if (search.trim()) params.search = search.trim();

      const data = await api.getKnowledgeDocuments(params);
      const docsArray = Array.isArray(data) ? data : (data?.results || []);
      setDocuments(docsArray);
    } catch (error) {
      console.error('Ошибка при загрузке документов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;
    try {
      await api.deleteKnowledgeDocument(id);
      loadDocuments();
    } catch (error) {
      alert('Ошибка при удалении документа');
    }
  };

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">База знаний</h1>
          <p className="text-sm text-slate-500 mt-1">Регламенты, инструкции и шаблоны документов</p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Загрузить документ
        </button>
      </div>

      {/* Фильтры и поиск */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-md border border-slate-200 shadow-sm">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-shadow"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'whitespace-nowrap text-sm px-4 py-2 rounded border transition-colors font-medium',
                activeCategory === cat.id 
                  ? 'bg-slate-100 border-slate-300 text-slate-800' 
                  : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-200'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Список документов */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-10 text-sm text-slate-500">Загрузка документов...</div>
        ) : documents.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center gap-4 group">
                
                {/* Иконка и инфо */}
                <div className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                  <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors">
                    {getFileIcon(doc.file_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors" title={doc.title}>
                      {doc.title}
                    </h3>
                    {doc.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1" title={doc.description}>
                        {doc.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span>{CATEGORIES.find(c => c.id === doc.category)?.label || 'Разное'}</span>
                      <span>•</span>
                      <span>{formatBytes(doc.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</span>
                      <span>•</span>
                      <span>Загрузил: {doc.uploaded_by_name || 'Система'}</span>
                    </div>
                  </div>
                </div>

                {/* Действия */}
                <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors shadow-sm"
                    title="Предпросмотр документа"
                  >
                    <Eye size={14} className="text-blue-600" />
                    Просмотр
                  </button>
                  <a
                    href={doc.file}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 border border-transparent rounded transition-colors"
                    title="Скачать файл"
                  >
                    <Download size={16} />
                  </a>
                  {/* Удалять может либо автор, либо админ/командир */}
                  {(user?.role === 'commander' || user?.role === 'admin' || user?.full_name === doc.uploaded_by_name) && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent rounded transition-colors"
                      title="Удалить документ"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 flex flex-col items-center justify-center">
            <FolderOpen size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Документы не найдены</p>
            <p className="text-xs text-slate-400 mt-1">Попробуйте изменить параметры поиска или загрузите новый файл.</p>
          </div>
        )}
      </div>

      {/* Модальное окно предпросмотра */}
      {previewDoc && (
        <PreviewModal 
          doc={previewDoc} 
          onClose={() => setPreviewDoc(null)} 
        />
      )}

      {/* Модальное окно загрузки */}
      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={() => { setShowUploadModal(false); loadDocuments(); }} 
        />
      )}
    </div>
  );
}

// ========== Модальное окно предпросмотра ==========
function PreviewModal({ doc, onClose }: { doc: Document, onClose: () => void }) {
  // Определяем тип файла по расширению
  const ext = doc.file_name.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';
  const isText = ['txt', 'json', 'csv'].includes(ext);
  const isPreviewable = isImage || isPdf || isText;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="flex-shrink-0">
              {getFileIcon(doc.file_name)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate" title={doc.title}>{doc.title}</h3>
              <p className="text-xs text-slate-500 truncate">{doc.file_name} • {formatBytes(doc.file_size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={doc.file}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download size={14} />
              Скачать
            </a>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors ml-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Тело модального окна (сам документ) */}
        <div className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center relative">
          {isImage && (
            <img src={doc.file} alt={doc.title} className="max-w-full max-h-full object-contain p-4 shadow-sm" />
          )}
          
          {(isPdf || isText) && (
            <iframe 
              src={doc.file} 
              className="w-full h-full border-0 bg-white" 
              title={doc.title}
            />
          )}

          {/* Заглушка для форматов (docx, xlsx и т.д.), которые браузер не может отрендерить сам */}
          {!isPreviewable && (
            <div className="text-center p-8 max-w-sm">
              <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-5 border border-slate-200">
                <File size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Предпросмотр недоступен</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Браузер не поддерживает встроенный просмотр файлов формата <span className="font-semibold text-slate-700 uppercase">.{ext}</span>. 
                Пожалуйста, скачайте файл для просмотра на вашем устройстве.
              </p>
              <a 
                href={doc.file} 
                download 
                target="_blank" 
                rel="noreferrer" 
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white font-medium rounded hover:bg-slate-700 transition-colors shadow-sm w-full"
              >
                <Download size={18} />
                Скачать файл
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== Модальное окно загрузки ==========
function UploadModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('instructions');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      alert('Укажите название и выберите файл');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('file', file);

      await api.uploadKnowledgeDocument(formData);
      onSuccess();
    } catch (error: any) {
      console.error(error);
      alert(`Ошибка при загрузке: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Загрузка документа</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Название документа *</label>
            <input 
              type="text" 
              required
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500" 
              placeholder="Например: Регламент безопасности 2026" 
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Категория</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 bg-white"
            >
              <option value="plans">Планы</option>
              <option value="instructions">Инструкции</option>
              <option value="regulations">Регламенты</option>
              <option value="templates">Шаблоны</option>
              <option value="other">Разное</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Описание (необязательно)</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 min-h-[80px] resize-none" 
              placeholder="Краткое описание содержимого..." 
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Файл *</label>
            <div 
              className="border-2 border-dashed border-slate-300 rounded p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden" 
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex flex-col items-center">
                  <FileText size={24} className="text-slate-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Download size={24} className="text-slate-400 mb-2" />
                  <p className="text-sm text-slate-600">Нажмите, чтобы выбрать файл</p>
                  <p className="text-xs text-slate-400 mt-1">До 100 МБ</p>
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm border border-slate-300 rounded text-slate-700 hover:bg-white transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isUploading || !file || !title.trim()}
            className="px-4 py-2 text-sm bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {isUploading ? 'Загрузка...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}