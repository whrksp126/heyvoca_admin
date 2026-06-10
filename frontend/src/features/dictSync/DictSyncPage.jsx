// 사전 동기화 — objectstore 허브 기준 올리기(발행)/내려받기(적용)/버전이력.
// 파괴적 작업이라 모든 액션에 경고 + 이중 확인(ConfirmModal 2단계).
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Tag, Spinner, Textarea, Field } from '@/components/ui/primitives';
import { Modal, ConfirmModal } from '@/components/ui/overlays';
import { ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { getDictStatus, getDictVersions, publishDict, applyDict } from '@/lib/endpoints';

const ENV_TONE = { prod: 'red', stg: 'yellow', dev: 'blue', local: 'gray' };

function fmtDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
}
const nf = (n) => (typeof n === 'number' ? n.toLocaleString() : (n ?? '-'));

export default function DictSyncPage({ onAuthError }) {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 올리기 모달
  const [pubOpen, setPubOpen] = useState(false);
  const [pubMsg, setPubMsg] = useState('');
  const [pubConfirm, setPubConfirm] = useState(false);
  // 내려받기/받기 — applyTarget: 적용할 버전 entry, step: 1=경고 2=최종확인
  const [applyTarget, setApplyTarget] = useState(null);
  const [applyStep, setApplyStep] = useState(0);

  const handleErr = useCallback((e, fallback) => {
    if (e instanceof ApiError && e.status === 401) { onAuthError?.(); return; }
    toast.error(e?.message || fallback);
  }, [onAuthError, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([getDictStatus(), getDictVersions()]);
      setStatus(s?.data); setVersions(v?.data || []);
    } catch (e) { handleErr(e, '사전 상태를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [handleErr]);

  useEffect(() => { load(); }, [load]);

  const doPublish = async () => {
    setPubConfirm(false); setBusy(true);
    try {
      const res = await publishDict({ confirm: true, message: pubMsg, expected_latest: status?.latest?.version || null });
      toast.success(`발행 완료: ${res?.data?.version}`);
      setPubOpen(false); setPubMsg('');
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast.error(e.message || '그새 다른 발행이 있었습니다. 새로고침 후 다시 시도하세요.');
      else handleErr(e, '발행에 실패했습니다.');
    } finally { setBusy(false); }
  };

  const doApply = async () => {
    const target = applyTarget;
    setApplyStep(0); setApplyTarget(null); setBusy(true);
    try {
      const res = await applyDict({ confirm: true, version: target?.version || null });
      toast.success(`적용 완료: ${res?.data?.version}`);
      await load();
    } catch (e) { handleErr(e, '적용에 실패했습니다.'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="h-full grid place-items-center"><Spinner label="사전 상태 확인 중…" /></div>;

  const env = status?.env || 'local';
  const isProd = env === 'prod';
  const latest = status?.latest;
  const curVoca = status?.env_voca_count;
  // 내려받기 대상(최신)과 버전별 단어 감소 경고 계산
  const targetCounts = applyTarget?.counts?.voca;
  const fewer = typeof targetCounts === 'number' && typeof curVoca === 'number' && targetCounts < curVoca;

  return (
    <div className="h-full overflow-y-auto thin-scroll">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-layout-black">사전 동기화</h1>
            <p className="text-sm text-layout-gray-300 mt-0.5">objectstore를 허브로 사전 DB(단어·단어장·북스토어)를 올리고 내려받습니다.</p>
          </div>
          <Button variant="ghost" onClick={load}>새로고침</Button>
        </div>

        {/* 상태 카드 */}
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="text-xs text-layout-gray-300 mb-1">현재 환경</div>
              <Tag tone={ENV_TONE[env] || 'gray'}>{env.toUpperCase()}</Tag>
            </div>
            <div>
              <div className="text-xs text-layout-gray-300 mb-1">이 환경 버전</div>
              <div className="text-sm font-semibold text-layout-black">{status?.env_version || '(없음)'}</div>
              <div className="text-xs text-layout-gray-300">단어 {nf(curVoca)}개</div>
            </div>
            <div>
              <div className="text-xs text-layout-gray-300 mb-1">objectstore 최신</div>
              <div className="text-sm font-semibold text-layout-black">{latest?.version || '(미발행)'}</div>
              {latest && <div className="text-xs text-layout-gray-300">{latest.publisher} · {fmtDate(latest.published_at)}</div>}
            </div>
            <div className="ml-auto">
              {status?.never_published
                ? <Tag tone="gray">허브 미발행</Tag>
                : status?.in_sync
                  ? <Tag tone="green">최신과 일치</Tag>
                  : <Tag tone="yellow">최신과 다름</Tag>}
            </div>
          </div>

          <div className="flex gap-2 mt-5 pt-4 border-t border-layout-gray-100">
            <Button onClick={() => { setPubMsg(''); setPubOpen(true); }}>
              ⬆ 올리기 (이 환경 → 최신 발행)
            </Button>
            <Button
              variant="secondary"
              disabled={status?.never_published}
              onClick={() => { setApplyTarget(latest); setApplyStep(1); }}
            >
              ⬇ 내려받기 (최신 적용)
            </Button>
          </div>
        </Card>

        {/* 버전 이력 */}
        <Card className="p-5">
          <div className="text-sm font-bold text-layout-black mb-3">버전 이력 <span className="text-layout-gray-300 font-normal">(최근 {versions.length})</span></div>
          {versions.length === 0 ? (
            <div className="text-sm text-layout-gray-300 py-6 text-center">아직 발행된 버전이 없습니다. '올리기'로 첫 버전을 발행하세요.</div>
          ) : (
            <div className="divide-y divide-layout-gray-100">
              {versions.map((v, i) => (
                <div key={v.version} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-layout-black">{v.version}</span>
                      {i === 0 && <Tag tone="green">최신</Tag>}
                      {v.env && <Tag tone={ENV_TONE[v.env] || 'gray'}>{v.env}</Tag>}
                    </div>
                    <div className="text-xs text-layout-gray-300 mt-0.5 truncate">
                      단어 {nf(v.counts?.voca)} · {v.publisher} · {fmtDate(v.published_at)}
                      {v.message ? ` · ${v.message}` : ''}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => { setApplyTarget(v); setApplyStep(1); }}>
                    이 버전 받기
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-xs text-layout-gray-300">
          ※ 내려받기/받기는 이 환경 사전을 <b>전체 교체</b>(병합 아님)합니다. 적용 전 자동 백업되지만 신중히 진행하세요.
        </p>
      </div>

      {/* 올리기 모달 (메모 입력 + 경고) */}
      <Modal
        open={pubOpen}
        onClose={() => !busy && setPubOpen(false)}
        title="사전 올리기 (발행)"
        size="md"
        footer={(
          <>
            <button onClick={() => setPubOpen(false)} disabled={busy}
              className="px-3.5 py-2 text-sm rounded-lg border border-layout-gray-100 text-layout-gray-500 hover:bg-layout-gray-50">취소</button>
            <Button onClick={() => setPubConfirm(true)} loading={busy}>발행하기</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="text-sm text-secondary-yellow-600 bg-secondary-yellow-100 rounded-lg px-3 py-2.5 leading-relaxed">
            ⚠️ <b>{env.toUpperCase()}</b> 환경의 사전 전체가 objectstore <b>최신본</b>이 됩니다.
            다른 환경은 '내려받기'로 이걸 받게 됩니다.
            {status?.stale && (
              <div className="mt-1.5 text-status-error-600">
                현재 허브 최신({latest?.version})보다 이 환경이 다릅니다 — 올리면 그 내용을 덮어쓰게 됩니다.
              </div>
            )}
          </div>
          <Field label="변경 메모 (선택)" hint="무엇을 바꿨는지 적어두면 이력에서 확인됩니다.">
            <Textarea rows={3} value={pubMsg} onChange={(e) => setPubMsg(e.target.value)}
              placeholder="예: 토익 단어 120개 추가, 오타 수정" />
          </Field>
        </div>
      </Modal>

      {/* 올리기 최종 확인 */}
      <ConfirmModal
        open={pubConfirm}
        title="정말 발행할까요?"
        tone="primary"
        confirmText="발행"
        message={`${env.toUpperCase()} 환경의 사전을 objectstore 최신으로 발행합니다.\n이 작업 후 다른 환경은 이 버전을 받게 됩니다.`}
        onCancel={() => setPubConfirm(false)}
        onConfirm={doPublish}
      />

      {/* 내려받기 1단계 — 경고 */}
      <ConfirmModal
        open={applyStep === 1 && !!applyTarget}
        title={`'${applyTarget?.version}' 버전을 받을까요?`}
        tone="danger"
        confirmText="계속"
        message={
          `이 환경(${env.toUpperCase()})의 사전이 선택한 버전으로 전체 교체됩니다 (병합 아님).\n` +
          `대상 단어수: ${nf(applyTarget?.counts?.voca)} / 현재: ${nf(curVoca)}` +
          (fewer ? `\n\n⚠️ 선택 버전이 현재보다 단어가 ${nf(curVoca - targetCounts)}개 적습니다.` +
            (isProd ? '\nprod에서는 그 단어를 학습 중인 사용자 데이터에 영향이 갈 수 있습니다.' : '') : '')
        }
        onCancel={() => { setApplyStep(0); setApplyTarget(null); }}
        onConfirm={() => setApplyStep(2)}
      />

      {/* 내려받기 2단계 — 최종 확인 */}
      <ConfirmModal
        open={applyStep === 2 && !!applyTarget}
        title="되돌릴 수 없습니다. 진행할까요?"
        tone="danger"
        confirmText={busy ? '적용 중…' : '적용'}
        message={`${env.toUpperCase()} 환경의 사전을 '${applyTarget?.version}'(으)로 지금 교체합니다.`}
        onCancel={() => { setApplyStep(0); setApplyTarget(null); }}
        onConfirm={doApply}
      />
    </div>
  );
}
