import { useState } from 'react';
import { Icon } from '../ui/Icon';

interface QuickChatDrawerProps {
  onClose: () => void;
  onSend: (message: string) => void;
}

const phrases = ['大家好，准备开始吧！', '出得漂亮。', '稍等一下，我想想。', '合作愉快！', '再来一局！'];
const emojis = [
  { icon: '🙂', label: '微笑' },
  { icon: '👍', label: '赞' },
  { icon: '👏', label: '鼓掌' },
  { icon: '🤔', label: '思考' },
  { icon: '✨', label: '加油' },
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
      <div className="drawer-list">
        {tab === 'phrases' ? phrases.map((phrase) => (
          <button key={phrase} onClick={() => onSend(phrase)} type="button">{phrase}</button>
        )) : emojis.map((emoji) => (
          <button className="emoji-option" key={emoji.label} onClick={() => onSend(`${emoji.icon} ${emoji.label}`)} type="button">
            <span aria-hidden="true">{emoji.icon}</span>
            {emoji.label}
          </button>
        ))}
      </div>
      <p>消息会公开显示给全桌玩家</p>
    </aside>
  );
}
