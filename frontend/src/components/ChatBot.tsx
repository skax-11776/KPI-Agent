/**
 * 챗봇 컴포넌트
 */

import React, { useState, useRef, useEffect } from 'react';
import { askQuestion } from '../services/api';
import { ChatMessage } from '../types';
import LoadingSpinner from './LoadingSpinner';

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: '안녕하세요! 과거 알람 이력에 대해 질문해주세요. 🤖',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 추가 시 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await askQuestion(input.trim());

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `죄송합니다. 오류가 발생했습니다: ${
          error.response?.data?.detail || error.message
        }`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-[600px]">
      {/* 헤더 */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <h2 className="text-xl font-bold">💬 AI 챗봇</h2>
        <p className="text-sm text-blue-100">과거 알람 이력에 대해 질문하세요</p>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {message.timestamp.toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <LoadingSpinner message="" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="질문을 입력하세요..."
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            전송
          </button>
        </div>

        {/* 예시 질문 */}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => setInput('최근 장비 다운타임이 발생한 적이 있나요?')}
            disabled={loading}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-300 disabled:opacity-50"
          >
            💡 다운타임 문의
          </button>
          <button
            onClick={() => setInput('HOLD 상태가 자주 발생하는 이유는?')}
            disabled={loading}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-300 disabled:opacity-50"
          >
            💡 HOLD 원인
          </button>
          <button
            onClick={() =>
              setInput('레시피 복잡도가 높으면 어떤 문제가 생기나요?')
            }
            disabled={loading}
            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-300 disabled:opacity-50"
          >
            💡 레시피 영향
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;