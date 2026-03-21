import { useState, useRef, useEffect } from 'react';
import { 
  Send, Paperclip, X, Image, FileText, Download, 
  User, Calendar, MoreVertical, Edit2, Trash2 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import api from '@/services/api';

interface Attachment {
  id: string;
  url: string;
  name: string;
}

interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userFullName: string;
  userRank: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
}

interface TaskCommentsProps {
  taskId: string;
  comments: Comment[];
  onAddComment: (comment: Comment) => void;
  onDeleteComment: (commentId: string) => void;
  onEditComment: (commentId: string, newText: string) => void;
}

export function TaskComments({ 
  taskId, 
  comments, 
  onAddComment, 
  onDeleteComment, 
  onEditComment 
}: TaskCommentsProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Прокрутка к последнему комментарию
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendComment = async () => {
    if (!newComment.trim() && attachments.length === 0) return;

    // Здесь будет вызов API для сохранения комментария
    const newCommentObj: Comment = {
      id: Date.now().toString(), // Временный ID
      taskId,
      userId: user?.id.toString() || '',
      userFullName: user?.full_name || '',
      userRank: user?.rank || '',
      text: newComment,
      createdAt: new Date().toISOString(),
      attachments: attachments.map(f => ({
        id: Math.random().toString(),
        url: URL.createObjectURL(f),
        name: f.name
      }))
    };

    onAddComment(newCommentObj);
    setNewComment('');
    setAttachments([]);
    setShowAttachmentMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    setShowAttachmentMenu(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
  };

  const saveEdit = () => {
    if (editingCommentId && editText.trim()) {
      onEditComment(editingCommentId, editText);
      setEditingCommentId(null);
      setEditText('');
    }
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <span>Обсуждение</span>
        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
          {comments.length}
        </span>
      </h3>

      {/* Список комментариев */}
      <div className="space-y-3 max-h-80 overflow-y-auto mb-3 pr-2">
        {comments.map((comment) => (
          <div key={comment.id} className="group relative">
            <div className="flex gap-3">
              {/* Аватар */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                  {comment.userFullName.split(' ').map(n => n[0]).join('')}
                </div>
              </div>

              {/* Контент */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-800">
                    {comment.userRank} {comment.userFullName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>

                {editingCommentId === comment.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/30"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="text-xs px-2 py-1 bg-emerald-700 text-white rounded hover:bg-emerald-800"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {comment.text}
                    </p>

                    {/* Вложения */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {comment.attachments.map((att) => (
                          <div key={att.id} className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200">
                            <FileText size={12} className="text-slate-400" />
                            <span className="text-xs text-slate-600">{att.name}</span>
                            <a 
                              href={att.url} 
                              download={att.name}
                              className="ml-1 p-0.5 hover:bg-slate-200 rounded"
                            >
                              <Download size={10} className="text-slate-500" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Кнопки действий (только для своих комментариев) */}
              {comment.userId === user?.id.toString() && !editingCommentId && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => startEditing(comment)}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    title="Редактировать"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                    title="Удалить"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={commentsEndRef} />
      </div>

      {/* Поле ввода нового комментария */}
      <div className="relative">
        {/* Прикрепленные файлы */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200">
                {file.type.startsWith('image/') ? (
                  <Image size={12} className="text-slate-400" />
                ) : (
                  <FileText size={12} className="text-slate-400" />
                )}
                <span className="text-xs text-slate-600 max-w-[100px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="ml-1 p-0.5 hover:bg-slate-200 rounded"
                >
                  <X size={10} className="text-slate-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Поле ввода */}
        <div className="flex items-end gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Напишите комментарий..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/30 resize-none min-h-[60px]"
          />
          
          <div className="flex flex-col gap-1">
            {/* Кнопка прикрепления файлов */}
            <div className="relative">
              <button
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors"
                title="Прикрепить файл"
              >
                <Paperclip size={18} />
              </button>
              
              {showAttachmentMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[150px]">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText size={14} />
                    Документ
                  </button>
                  <button
                    onClick={() => {
                      // Здесь можно добавить выбор изображения
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Image size={14} />
                    Изображение
                  </button>
                </div>
              )}
            </div>

            {/* Кнопка отправки */}
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim() && attachments.length === 0}
              className="p-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Отправить"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Скрытый input для загрузки файлов */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
        />
      </div>

      {/* Подсказка */}
      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
        <span>Enter для отправки • Shift+Enter для новой строки</span>
      </div>
    </div>
  );
}