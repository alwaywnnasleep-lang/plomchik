import { useState, useRef } from 'react';
import { 
  Upload, FileText, X, CheckCircle, AlertCircle, 
  Download, Eye, Send, Paperclip, Image, File
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';
import api from '@/services/api';
import type { Task, TaskFile, TaskSubmission } from '@/types';

interface TaskSubmissionProps {
  task: Task;
  onTaskUpdate: (updatedTask: Task) => void;
}

export function TaskSubmission({ task, onTaskUpdate }: TaskSubmissionProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAssignee = user?.id.toString() === task.assigneeId;
  const isCreator = user?.id.toString() === task.creatorId;
  const canSubmit = isAssignee && task.status === 'in_progress';
  const canReview = isCreator && task.status === 'review';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setSubmitting(true);
    try {
      // Сначала загружаем файлы
      const uploadedFiles: TaskFile[] = [];
      for (const file of files) {
        const uploaded = await api.uploadTaskFile(parseInt(task.id), file, 'submission');
        uploadedFiles.push(uploaded);
      }
      
      // Отправляем задание на проверку
      const submission = await api.submitTask(parseInt(task.id), comment);
      
      // Обновляем задачу
      const updatedTask: Task = {
        ...task,
        status: 'review' as const,
        submission: {
          ...submission,
          files: uploadedFiles,
        },
      };
      
      onTaskUpdate(updatedTask);
      setFiles([]);
      setComment('');
    } catch (error) {
      console.error('Failed to submit task:', error);
      alert('Ошибка при сдаче задания');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!canReview) return;
    
    setSubmitting(true);
    try {
      await api.approveTask(parseInt(task.id), reviewComment);
      
      const updatedTask: Task = {
        ...task,
        status: 'done' as const,
        submission: task.submission ? {
          ...task.submission,
          status: 'approved',
          reviewedBy: user?.id.toString(),
          reviewedAt: new Date().toISOString(),
          reviewComment,
        } : undefined,
      };
      
      onTaskUpdate(updatedTask);
      setReviewComment('');
    } catch (error) {
      console.error('Failed to approve task:', error);
      alert('Ошибка при подтверждении');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!canReview || !reviewComment) {
      alert('Укажите причину отклонения');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.rejectTask(parseInt(task.id), reviewComment);
      
      const updatedTask: Task = {
        ...task,
        status: 'in_progress' as const,
        submission: task.submission ? {
          ...task.submission,
          status: 'rejected',
          reviewedBy: user?.id.toString(),
          reviewedAt: new Date().toISOString(),
          reviewComment,
        } : undefined,
      };
      
      onTaskUpdate(updatedTask);
      setReviewComment('');
    } catch (error) {
      console.error('Failed to reject task:', error);
      alert('Ошибка при отклонении');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <CheckCircle size={16} className="text-green-700" />
        Выполнение задания
      </h3>

      {/* Статус выполнения */}
      {task.submission && (
        <div className={cn(
          'mb-4 p-3 rounded-lg border',
          task.submission.status === 'approved' ? 'bg-green-50 border-green-200' :
          task.submission.status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-yellow-50 border-yellow-200'
        )}>
          <div className="flex items-center gap-2 mb-2">
            {task.submission.status === 'approved' ? (
              <CheckCircle size={16} className="text-green-700" />
            ) : task.submission.status === 'rejected' ? (
              <AlertCircle size={16} className="text-red-700" />
            ) : (
              <Send size={16} className="text-yellow-700" />
            )}
            <span className="text-sm font-medium">
              {task.submission.status === 'approved' ? 'Принято' :
               task.submission.status === 'rejected' ? 'Отклонено' : 'На проверке'}
            </span>
          </div>
          
          {task.submission.comment && (
            <p className="text-sm text-slate-600 mb-2">{task.submission.comment}</p>
          )}
          
          {task.submission.files && task.submission.files.length > 0 && (
            <div className="mt-2 space-y-1">
              {task.submission.files.map(file => (
                <div key={file.id} className="flex items-center gap-2 text-xs">
                  <FileText size={12} className="text-slate-400" />
                  <span className="text-slate-600">{file.fileName}</span>
                  <a href={file.fileUrl} download className="ml-auto text-blue-600 hover:text-blue-800">
                    <Download size={12} />
                  </a>
                </div>
              ))}
            </div>
          )}
          
          {task.submission.reviewComment && (
            <div className="mt-2 p-2 bg-white rounded text-sm">
              <span className="font-medium">Комментарий проверяющего:</span>
              <p className="text-slate-600 mt-1">{task.submission.reviewComment}</p>
            </div>
          )}
        </div>
      )}

      {/* Форма сдачи задания (для исполнителя) */}
      {canSubmit && (
        <div className="space-y-4">
          {/* Загруженные файлы */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  {file.type.startsWith('image/') ? (
                    <Image size={16} className="text-slate-400" />
                  ) : (
                    <FileText size={16} className="text-slate-400" />
                  )}
                  <span className="text-sm text-slate-600 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-slate-200 rounded"
                  >
                    <X size={14} className="text-slate-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Кнопка загрузки файлов */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Paperclip size={14} />
              Прикрепить файлы
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
          </div>

          {/* Комментарий к сдаче */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Добавьте комментарий к выполненному заданию..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
            rows={3}
          />

          {/* Кнопка отправки */}
          <button
            onClick={handleSubmit}
            disabled={submitting || files.length === 0}
            className="w-full py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              'Отправка...'
            ) : (
              <>
                <Send size={16} />
                Отправить на проверку
              </>
            )}
          </button>
        </div>
      )}

      {/* Форма проверки (для создателя) */}
      {canReview && task.status === 'review' && (
        <div className="space-y-4">
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Комментарий к проверке..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700/30"
            rows={3}
          />
          
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex-1 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Принять
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <X size={16} />
              Отклонить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}