// 신고 관리 — 앱 학습 중 사용자가 보낸 데이터 오류 신고 + 사전 없는 단어 '사전 추가 요청'
// (heyvoca_back app/routes/content_report.py). 탭: 학습 중 오류 신고(kind=content) / 사전 추가 요청(단어별 묶음).
// 목록·필터 / 신고 많은 단어 묶음 / 상세(신고 순간 화면 스냅샷) / 단어 편집 Drawer 로 바로 이동 / 상태 변경.
// AI 일괄 처리는 heyvoca_back/scripts/export_content_reports.py (heyvoca_service/docs/CONTENT_REPORT.md).
import React, { useCallback, useEffect, useState } from 'react';
import { PencilSimple, Flag, BookOpenText } from '@phosphor-icons/react';
import { Button, Card, Input, Select, Spinner, Tag, Textarea, Field } from '@/components/ui/primitives';
import { Drawer } from '@/components/ui/overlays';
import { ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import VocaDetailDrawer from '@/features/voca/VocaDetailDrawer';
import { listReports, getReportSummary, getReport, patchReport, bulkPatchReports } from './api';
import DictMissingPanel from './DictMissingPanel';
import { STATUS_LABEL, STATUS_TONE, fmtDate } from './shared';

const REASON_LABEL = {
  meaning: '뜻이 틀림', example: '예문이 이상함', audio: '발음·음성 문제',
  grading: '정답 판정이 틀림', question: '문제가 이상함', other: '기타',
};
const LANG_LABEL = { en: '영어', ja: '일본어', script: '글자', custom: '직접 추가' };


const TABS = [
  { key: 'content', label: '학습 중 오류 신고', icon: Flag },
  { key: 'dict_missing', label: '사전 추가 요청', icon: BookOpenText },
];

export default function ReportsPage({ onAuthError }) {
  const [tab, setTab] = useState(() => {
    try { return sessionStorage.getItem('reports.tab') || 'content'; } catch { return 'content'; }
  });
  const pick = (k) => {
    setTab(k);
    try { sessionStorage.setItem('reports.tab', k); } catch { /* noop */ }
  };
  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-layout-black">신고 관리</h2>
        <div className="mt-3 flex gap-1 border-b border-layout-gray-100">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              className={`flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-sm font-semibold ${tab === key ? 'border-primary-main-600 text-primary-main-600' : 'border-transparent text-layout-gray-400 hover:text-layout-gray-500'}`}
            >
              <Icon size={16} weight="bold" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'content'
        ? <ContentReports onAuthError={onAuthError} />
        : <DictMissingPanel onAuthError={onAuthError} />}
    </div>
  );
}

function ContentReports({ onAuthError }) {
  const toast = useToast();
  const [filters, setFilters] = useState({ kind: 'content', sort: '', status: 'open', reason: '', lang: '', from: '', to: '', q: '', voca_id: '' });
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ items: [], total: 0, has_more: false });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(() => new Set());
  const [detailId, setDetailId] = useState(null);
  const [editVocaId, setEditVocaId] = useState(null);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast.error(e?.message || fallback);
  }, [onAuthError, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([listReports({ ...filters, page }), getReportSummary(filters)]);
      setList(l?.data || { items: [], total: 0 });
      setSummary(s?.data || null);
      setChecked(new Set());
    } catch (e) { handleErr(e, '신고 목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [filters, page, handleErr]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };

  const toggle = (id) => setChecked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const bulk = async (status) => {
    if (!checked.size) return;
    try {
      await bulkPatchReports({ ids: [...checked], status });
      toast.success(`${checked.size}건을 '${STATUS_LABEL[status]}'(으)로 바꿨습니다.`);
      load();
    } catch (e) { handleErr(e, '상태 변경에 실패했습니다.'); }
  };

  const items = list.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-layout-gray-300 mt-0.5">
            학습 중 사용자가 보낸 뜻·예문·발음·채점 오류 신고. 조건에 맞는 {list.total?.toLocaleString?.() ?? 0}건
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.by_status || {}).map(([s, n]) => (
              <Tag key={s} tone={STATUS_TONE[s]}>{STATUS_LABEL[s]} {n}</Tag>
            ))}
          </div>
        )}
      </div>

      {/* 필터 */}
      <Card className="p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="정렬">
          <option value="">최신순</option>
          <option value="count">같은 단어 신고 많은 순</option>
        </Select>
        <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="상태">
          <option value="">상태 전체</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={filters.reason} onChange={(e) => setFilter('reason', e.target.value)} aria-label="사유">
          <option value="">사유 전체</option>
          {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={filters.lang} onChange={(e) => setFilter('lang', e.target.value)} aria-label="언어">
          <option value="">언어 전체</option>
          {Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="시작일" />
        <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="종료일" />
        <Input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="단어·메모 검색" aria-label="검색" />
      </Card>

      {/* 신고 많은 단어 */}
      {summary?.top_targets?.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-layout-gray-500">신고 많은 단어</h3>
            {filters.voca_id && (
              <Button size="sm" variant="ghost" onClick={() => setFilter('voca_id', '')}>단어 묶음 해제</Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.top_targets.map((t) => (
              <button
                key={`${t.dict_lang}:${t.key}`}
                type="button"
                onClick={() => t.voca_id && setFilter('voca_id', String(t.voca_id))}
                className={`text-left px-2.5 py-1.5 rounded-lg border text-xs ${String(t.voca_id) === filters.voca_id ? 'border-primary-main-600 bg-primary-main-100' : 'border-layout-gray-100 hover:bg-layout-gray-50'}`}
              >
                <span className="font-semibold text-layout-black">{t.word || t.key}</span>
                <span className="ml-1 text-primary-main-600 font-bold">{t.count}</span>
                <span className="ml-1 text-layout-gray-300">{LANG_LABEL[t.dict_lang] || t.dict_lang} · {(t.reasons || []).map((r) => REASON_LABEL[r] || r).join(', ')}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* 일괄 처리 */}
      {checked.size > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-layout-gray-400">{checked.size}건 선택</span>
          <Button size="sm" onClick={() => bulk('resolved')}>처리</Button>
          <Button size="sm" variant="secondary" onClick={() => bulk('rejected')}>반려</Button>
          <Button size="sm" variant="ghost" onClick={() => bulk('open')}>대기로</Button>
        </div>
      )}

      {/* 목록 */}
      <Card className="overflow-hidden">
        {loading ? <Spinner label="신고 목록을 불러오는 중…" /> : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-layout-gray-300">조건에 맞는 신고가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-layout-gray-50 text-layout-gray-400 text-xs">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2 text-left">신고 시각</th>
                  <th className="px-3 py-2 text-left">단어</th>
                  <th className="px-3 py-2 text-left">사유</th>
                  <th className="px-3 py-2 text-left">메모</th>
                  <th className="px-3 py-2 text-left">문제 유형</th>
                  <th className="px-3 py-2 text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-layout-gray-100 hover:bg-layout-gray-50 cursor-pointer" onClick={() => setDetailId(r.id)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`신고 ${r.id} 선택`} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-layout-gray-400">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-layout-black">{r.word || r.target_key || '-'}</span>
                      {r.target_count > 1 && <span className="ml-1 text-xs font-bold text-primary-main-600">{r.target_count}건</span>}
                      <span className="ml-1.5 text-[11px] text-layout-gray-300">{LANG_LABEL[r.dict_lang] || r.dict_lang || ''}{r.voca_id ? ` #${r.voca_id}` : ''}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap"><Tag tone="pink">{r.reason_label}</Tag></td>
                    <td className="px-3 py-2 max-w-[280px] truncate text-layout-gray-500">{r.memo || ''}</td>
                    <td className="px-3 py-2 text-xs text-layout-gray-400">{r.question_type || '-'}</td>
                    <td className="px-3 py-2"><Tag tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] || r.status}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(page > 1 || list.has_more) && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
          <span className="text-sm text-layout-gray-400 self-center">{page} 페이지</span>
          <Button size="sm" variant="secondary" disabled={!list.has_more} onClick={() => setPage((p) => p + 1)}>다음</Button>
        </div>
      )}

      {detailId != null && (
        <ReportDetailDrawer
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => { setDetailId(null); load(); }}
          onEditVoca={(vid) => setEditVocaId(vid)}
          handleErr={handleErr}
          toast={toast}
        />
      )}
      {editVocaId != null && (
        <VocaDetailDrawer
          vocaId={editVocaId}
          onClose={() => setEditVocaId(null)}
          onSaved={() => setEditVocaId(null)}
          onAuthError={onAuthError}
          toast={toast}
        />
      )}
    </div>
  );
}

// 스냅샷의 예문 HTML(<strong class="target-word">)은 태그만 걷어 글자로 보여 준다
const stripTags = (s) => (typeof s === 'string' ? s.replace(/<[^>]+>/g, '') : s);

function SnapshotView({ snap }) {
  if (!snap) return <p className="text-sm text-layout-gray-300">스냅샷 없음</p>;
  const opts = Array.isArray(snap.options) ? snap.options : null;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-lg font-bold text-layout-black">{snap.origin || snap.char || '-'}</span>
        {snap.reading && <span className="text-layout-gray-400">{snap.reading}</span>}
        {snap.is_correct === true && <Tag tone="green">정답 처리</Tag>}
        {snap.is_correct === false && <Tag tone="red">오답 처리</Tag>}
        {snap.is_retry && <Tag tone="yellow">재출제</Tag>}
      </div>
      {Array.isArray(snap.meanings) && snap.meanings.length > 0 && (
        <p className="text-layout-gray-500">뜻: {snap.meanings.join(', ')}</p>
      )}
      {Array.isArray(snap.set_words) && (
        <p className="text-layout-gray-400 text-xs">같이 나온 단어: {snap.set_words.join(', ')}</p>
      )}
      {opts && (
        <ol className="space-y-1">
          {opts.map((o, i) => {
            const label = o?.origin && snap.question_type === 'reverseMultipleChoice'
              ? o.origin
              : (Array.isArray(o?.meanings) ? o.meanings.join(', ') : (o?.origin || o?.char || ''));
            const isAnswer = i === snap.result_index;
            const isPicked = i === snap.user_answer_index;
            return (
              <li key={i} className={`px-2.5 py-1.5 rounded-md border ${isAnswer ? 'border-status-success-500 bg-status-success-100' : isPicked ? 'border-status-error-500 bg-status-error-100' : 'border-layout-gray-100'}`}>
                {i + 1}. {label}
                {isAnswer && <span className="ml-2 text-xs text-status-success-600">정답</span>}
                {isPicked && !isAnswer && <span className="ml-2 text-xs text-status-error-600">사용자 선택</span>}
              </li>
            );
          })}
        </ol>
      )}
      {Array.isArray(snap.examples) && snap.examples.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-layout-gray-400">예문</p>
          {snap.examples.map((e, i) => (
            <p key={i} className="text-layout-gray-500">{stripTags(e?.origin)} <span className="text-layout-gray-300">/ {stripTags(e?.meaning)}</span></p>
          ))}
        </div>
      )}
      <details>
        <summary className="text-xs text-layout-gray-300 cursor-pointer">원본 JSON</summary>
        <pre className="mt-1 p-2 bg-layout-gray-50 rounded-md text-[11px] overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(snap, null, 2)}</pre>
      </details>
    </div>
  );
}

function ReportDetailDrawer({ id, onClose, onChanged, onEditVoca, handleErr, toast }) {
  const [r, setR] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReport(id)
      .then((res) => { setR(res?.data); setNote(res?.data?.resolve_note || ''); })
      .catch((e) => handleErr(e, '신고를 불러오지 못했습니다.'));
  }, [id, handleErr]);

  const save = async (status) => {
    setSaving(true);
    try {
      await patchReport(id, { status, resolve_note: note || null });
      toast.success(`'${STATUS_LABEL[status]}'(으)로 바꿨습니다.`);
      onChanged();
    } catch (e) { handleErr(e, '상태 변경에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  const canEdit = r?.voca_id && r?.dict_lang === 'en';

  return (
    <Drawer open onClose={onClose} title={r ? `신고 #${r.id}` : '신고'} subtitle={r ? `${r.reason_label} · ${fmtDate(r.created_at)}` : ''}>
      {!r ? <Spinner /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2 items-center">
            <Tag tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Tag>
            <Tag tone="pink">{r.reason_label}</Tag>
            <Tag>{LANG_LABEL[r.dict_lang] || r.dict_lang || '-'}</Tag>
            {r.question_type && <Tag tone="blue">{r.question_type}</Tag>}
            {r.test_type && <Tag>{r.test_type}</Tag>}
            {r.same_target_count > 0 && <Tag tone="yellow">이 단어 다른 신고 {r.same_target_count}건</Tag>}
          </div>

          {r.memo && (
            <div className="p-3 rounded-lg bg-primary-main-100 text-sm text-layout-black">“{r.memo}”</div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button size="sm" variant="blue" onClick={() => onEditVoca(r.voca_id)}>
                <PencilSimple size={14} weight="bold" /> 사전 단어 편집 (#{r.voca_id})
              </Button>
            ) : (
              <span className="text-xs text-layout-gray-300">
                {r.dict_lang === 'ja' ? '일본어 사전은 어드민 편집 화면이 아직 없습니다 — 내보내기 스크립트로 처리하세요.'
                  : r.dict_lang === 'script' ? `글자 학습 데이터(${r.target_key || '-'}) — 프론트 정적 데이터에서 고칩니다.`
                  : '사전 단어가 아닙니다(사용자가 직접 추가한 단어).'}
              </span>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-layout-gray-500 mb-2">신고 순간 화면</h4>
            <SnapshotView snap={r.snapshot} />
          </div>

          <div className="text-xs text-layout-gray-300 space-y-0.5">
            <p>사용자 {r.user_id} · user_voca #{r.user_voca_id ?? '-'}</p>
            <p>{r.platform || '-'} · 앱 {r.app_version || '-'} · 웹 {r.web_version || '-'}</p>
            {r.resolved_at && <p>처리 {fmtDate(r.resolved_at)}{r.resolved_by ? ` · ${r.resolved_by}` : ''}</p>}
          </div>

          <Field label="처리 메모">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="무엇을 고쳤는지 / 기각 사유" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button loading={saving} onClick={() => save('resolved')}>처리</Button>
            <Button variant="secondary" loading={saving} onClick={() => save('rejected')}>반려</Button>
            {r.status !== 'open' && <Button variant="ghost" loading={saving} onClick={() => save('open')}>대기로 되돌리기</Button>}
          </div>
        </div>
      )}
    </Drawer>
  );
}
