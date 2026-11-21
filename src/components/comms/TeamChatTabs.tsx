'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Users, Globe, Crown } from 'lucide-react';
import { useAuctionStore } from '@/store/auctionStore';
import { FRANCHISES } from '@/data/franchises';
import { FranchiseCode } from '@/types/auction';

export const TeamChatTabs: React.FC = () => {
  const {
    roomCode,
    messages,
    franchiseCode,
    activeChatTab,
    setActiveChatTab,
    unreadGlobalCount,
    unreadTeamCount,
    sendChatMessage,
  } = useAuctionStore();

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const franchise = franchiseCode ? FRANCHISES[franchiseCode] : null;

  // Filter messages based on active tab
  const filteredMessages = messages.filter((msg) => {
    if (activeChatTab === 'GLOBAL') {
      return msg.channel === 'GLOBAL';
    }
    return msg.channel === franchiseCode;
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [filteredMessages.length, activeChatTab]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const channel: 'GLOBAL' | FranchiseCode =
      activeChatTab === 'GLOBAL' ? 'GLOBAL' : (franchiseCode as FranchiseCode);

    sendChatMessage(inputMessage.trim(), channel);
    setInputMessage('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col h-full flex-1 min-h-[300px] shadow-xl backdrop-blur-md">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 pb-2 gap-2">
        <button
          onClick={() => setActiveChatTab('GLOBAL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition relative ${
            activeChatTab === 'GLOBAL'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>All Teams (Global)</span>
          {unreadGlobalCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
              {unreadGlobalCount}
            </span>
          )}
        </button>

        {franchise && (
          <button
            onClick={() => setActiveChatTab('TEAM')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition relative ${
              activeChatTab === 'TEAM'
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{franchise.shortName} Private</span>
            {unreadTeamCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-black flex items-center justify-center">
                {unreadTeamCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 text-xs">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-center p-4">
            <MessageSquare className="w-6 h-6 mb-1 opacity-40" />
            <span>No messages yet in this channel</span>
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const team = msg.franchiseCode ? FRANCHISES[msg.franchiseCode] : null;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className="flex flex-col bg-slate-950/70 rounded-lg p-2 border border-slate-800/70">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">{msg.senderName}</span>
                    {msg.senderRole === 'AUCTIONEER' && (
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        Auctioneer
                      </span>
                    )}
                    {team && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                        style={{
                          backgroundColor: `${team.primaryColor}25`,
                          borderColor: team.primaryColor,
                          color: team.primaryColor,
                        }}
                      >
                        {team.code}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{timeStr}</span>
                </div>
                <p className="text-slate-300 leading-relaxed break-words">{msg.content}</p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-slate-800">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={
            activeChatTab === 'GLOBAL'
              ? 'Message everyone in the Auction Room...'
              : `Message your ${franchise?.shortName || 'Team'} huddle...`
          }
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs flex items-center justify-center transition"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
