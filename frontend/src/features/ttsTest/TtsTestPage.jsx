// TTS 테스트 — 무료 엔진(Edge 신경망 · gTTS)의 목소리/옵션을 직접 들어보고 비교.
// 미리듣기는 캐싱 없이 즉석 생성(POST /api/tts/preview → audio/mpeg blob).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Card, Field, Textarea, Select, ToggleSwitch, Spinner, Tag } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { getTtsVoices, previewTts } from '@/lib/endpoints';
import { useToast } from '@/lib/toast';

const LANGS = [{ v: 'en', label: '영어' }, { v: 'ko', label: '한국어' }];
const fmtSigned = (n, unit) => `${n >= 0 ? '+' : ''}${n}${unit}`;

export default function TtsTestPage({ onAuthError }) {
  const toast = useToast();

  const [text, setText] = useState('Hello, how are you today?');
  const [language, setLanguage] = useState('en');
  const [engine, setEngine] = useState('edge');

  const [voices, setVoices] = useState([]);
  const [accents, setAccents] = useState([]);
  const [optLoading, setOptLoading] = useState(false);

  const [voice, setVoice] = useState('');
  const [rate, setRate] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [tld, setTld] = useState('com');
  const [slow, setSlow] = useState(false);

  const [results, setResults] = useState([]);
  const [generating, setGenerating] = useState(false);

  const resultsRef = useRef(results);
  resultsRef.current = results;

  // 엔진/언어 변경 시 옵션 목록 로드
  useEffect(() => {
    let alive = true;
    setOptLoading(true);
    getTtsVoices(engine, language)
      .then((r) => {
        if (!alive) return;
        const d = r?.data || {};
        if (engine === 'edge') {
          const vs = d.voices || [];
          setVoices(vs);
          setVoice((prev) => (vs.find((x) => x.short_name === prev) ? prev : (vs[0]?.short_name || '')));
        } else {
          const ac = d.accents || [];
          setAccents(ac);
          setTld((prev) => (ac.find((x) => x.tld === prev) ? prev : (ac[0]?.tld || 'com')));
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) onAuthError?.();
        else toast.error('옵션 목록을 불러오지 못했습니다.');
      })
      .finally(() => { if (alive) setOptLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, language]);

  // 언마운트 시 blob URL 정리(메모리 누수 방지)
  useEffect(() => () => { resultsRef.current.forEach((r) => URL.revokeObjectURL(r.url)); }, []);

  const generate = useCallback(async () => {
    const t = text.trim();
    if (!t) { toast.error('텍스트를 입력하세요.'); return; }

    const payload = { text: t, engine, language };
    let label;
    if (engine === 'edge') {
      if (!voice) { toast.error('목소리를 선택하세요.'); return; }
      payload.voice = voice;
      payload.rate = fmtSigned(rate, '%');
      payload.pitch = fmtSigned(pitch, 'Hz');
      label = `${voice}${rate ? ` · 속도${fmtSigned(rate, '%')}` : ''}${pitch ? ` · 피치${fmtSigned(pitch, 'Hz')}` : ''}`;
    } else {
      payload.tld = tld;
      payload.slow = slow;
      const an = accents.find((a) => a.tld === tld);
      label = `${an?.label || tld}${slow ? ' · 느림' : ''}`;
    }

    setGenerating(true);
    try {
      const blob = await previewTts(payload);
      const url = URL.createObjectURL(blob);
      const item = { id: Date.now(), url, label, text: t, engine };
      setResults((prev) => [item, ...prev]);
      try { new Audio(url).play(); } catch { /* 브라우저 자동재생 차단 시 무시(이력에서 재생 가능) */ }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthError?.();
      else toast.error(e?.message || '생성 실패');
    } finally {
      setGenerating(false);
    }
  }, [text, engine, language, voice, rate, pitch, tld, slow, accents, toast, onAuthError]);

  const removeResult = (id) => {
    setResults((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.id !== id);
    });
  };

  return (
    <div className="h-full overflow-y-auto thin-scroll px-8 py-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-layout-black">TTS 테스트</h1>
        <p className="text-sm text-layout-gray-300 mt-0.5">
          무료 엔진(Edge 신경망 · gTTS)의 목소리·옵션을 직접 들어보고 비교하세요. 생성물은 캐시에 저장되지 않습니다.
        </p>
      </header>

      <Card className="p-6 space-y-4">
        <Field label="텍스트">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="읽어줄 문장을 입력하세요 (최대 500자)" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="언어">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
            </Select>
          </Field>
          <Field label="엔진">
            <div className="flex gap-2">
              {[['edge', 'Edge (신경망)'], ['gtts', 'gTTS']].map(([en, lbl]) => (
                <button
                  key={en}
                  type="button"
                  onClick={() => setEngine(en)}
                  className={'flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ' +
                    (engine === en
                      ? 'bg-primary-main-600 text-white border-transparent'
                      : 'bg-white text-layout-gray-500 border-layout-gray-100 hover:bg-layout-gray-50')}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {optLoading ? (
          <Spinner label="옵션 불러오는 중…" />
        ) : engine === 'edge' ? (
          <div className="space-y-4">
            <Field label={`목소리 (${voices.length}개)`} hint="억양·성별이 다양한 신경망 보이스. 자연스러움/품질이 gTTS보다 우수합니다.">
              <Select value={voice} onChange={(e) => setVoice(e.target.value)}>
                {voices.map((v) => <option key={v.short_name} value={v.short_name}>{v.label}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`속도 ${fmtSigned(rate, '%')}`}>
                <input type="range" min="-50" max="50" step="5" value={rate}
                  onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-primary-main-600" />
              </Field>
              <Field label={`피치 ${fmtSigned(pitch, 'Hz')}`}>
                <input type="range" min="-50" max="50" step="5" value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))} className="w-full accent-primary-main-600" />
              </Field>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 items-end">
            <Field label="악센트" hint="gTTS는 목소리가 1종이며 악센트/속도만 조절됩니다.">
              <Select value={tld} onChange={(e) => setTld(e.target.value)}>
                {accents.map((a) => <option key={a.tld} value={a.tld}>{a.label}</option>)}
              </Select>
            </Field>
            <div className="pb-2">
              <ToggleSwitch checked={slow} onChange={setSlow} label="느리게" />
            </div>
          </div>
        )}

        <Button onClick={generate} loading={generating} size="lg" className="w-full">생성 후 재생</Button>
      </Card>

      {results.length > 0 && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-layout-black">생성 이력 ({results.length})</div>
            <button
              onClick={() => { results.forEach((r) => URL.revokeObjectURL(r.url)); setResults([]); }}
              className="text-xs text-layout-gray-300 hover:text-status-error-600"
            >
              전체 삭제
            </button>
          </div>
          {results.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-layout-gray-50">
              <Tag tone={r.engine === 'edge' ? 'blue' : 'gray'}>{r.engine === 'edge' ? 'Edge' : 'gTTS'}</Tag>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-layout-gray-500 truncate">{r.label}</div>
                <div className="text-[11px] text-layout-gray-300 truncate">{r.text}</div>
              </div>
              <audio controls src={r.url} className="h-9 max-w-[260px]" />
              <button onClick={() => removeResult(r.id)} className="text-layout-gray-300 hover:text-status-error-600 text-xs px-1">삭제</button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
