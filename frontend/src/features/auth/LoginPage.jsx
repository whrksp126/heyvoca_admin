// 어드민 로그인 (Admin 세션). 성공 시 onSuccess 콜백 → App 이 세션 재확인.
import React, { useState } from 'react';
import { login } from '../../lib/api';
import { Button, Input, Field } from '../../components/ui/primitives';

export default function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      onSuccess?.();
    } catch (err) {
      setError(err.status === 401 ? '아이디 또는 비밀번호를 확인하세요.' : (err.message || '로그인 실패'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full grid place-items-center bg-layout-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-layout-gray-100 p-7">
        <div className="text-2xl font-bold text-primary-main-600 mb-1">HeyVoca</div>
        <div className="text-sm text-layout-gray-300 mb-6">관리자 콘솔 로그인</div>

        <div className="space-y-4">
          <Field label="아이디">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
          </Field>
          <Field label="비밀번호" error={error}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
        </div>

        <Button type="submit" loading={loading} className="w-full mt-6" size="lg">로그인</Button>
      </form>
    </div>
  );
}
