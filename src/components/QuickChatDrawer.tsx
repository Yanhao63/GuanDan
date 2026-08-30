import { useState } from 'react';
import { Icon } from '../ui/Icon';

interface QuickChatDrawerProps {
  onClose: () => void;
  onSend: (message: string) => void;
}

export const quickPhrases = [
  '大家好，准备开始吧！',
  '出得漂亮。',
  '稍等一下，我想想。',
  '合作愉快！',
  '再来一局！',
  'NB',
  '快点出',
  '杀!!!!!',
  '你的炸太大了',
];
export const quickEmojis = [
  { icon: '🙂', label: '微笑' },
  { icon: '👍', label: '赞' },
  { icon: '👏', label: '鼓掌' },
  { icon: '🤔', label: '思考' },
  { icon: '✨', label: '加油' },
  { icon: '💩', label: '大便' },
];

export function QuickChatDrawer({ onClose, onSend }: QuickChatDrawerProps) {
  const [tab, setTab] = useState<'phrases' | 'emojis'>('phrases');

  return (
    <aside className="chat-drawer">
      <div className="drawer-header">
        <strong>桌上消息</strong>
        <button aria-label="关闭快捷语" className="icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
      </div>
      <div className="drawer-tabs">
        <button className={tab === 'phrases' ? 'drawer-tab drawer-tab-active' : 'drawer-tab'} onClick={() => setTab('phrases')} type="button"><Icon name="chat" size={18} /> 快捷语</button>
        <button className={tab === 'emojis' ? 'drawer-tab drawer-tab-active' : 'drawer-tab'} onClick={() => setTab('emojis')} type="button"><Icon name="smile" size={18} /> 表情</button>
      </div>
      <div className={`drawer-list${tab === 'emojis' ? ' drawer-emoji-grid' : ''}`}>
        {tab === 'phrases' ? quickPhrases.map((phrase) => (
          <button key={phrase} onClick={() => onSend(phrase)} type="button">{phrase}</button>
        )) : quickEmojis.map((emoji) => (
          <button aria-label={emoji.label} className="emoji-option" key={emoji.label} onClick={() => onSend(emoji.icon)} type="button">
            <span aria-hidden="true">{emoji.icon}</span>
          </button>
        ))}
      </div>
      <p>消息会公开显示给全桌玩家</p>
    </aside>
  );
}
