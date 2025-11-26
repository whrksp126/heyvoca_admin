// 단어 수정 예시
const editVocaForm = document.getElementById('editVocaForm');
if (editVocaForm) {
  editVocaForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('editVocaId').value;
    const data = {
      word: document.getElementById('editVocaWord').value,
      meaning: document.getElementById('editVocaMeaning').value,
      example: document.getElementById('editVocaExample').value,
      level: document.getElementById('editVocaLevel').value
    };
    const res = await fetch(`/api/voca/${id}`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
    if (res.ok) {
      location.reload();
    } else {
      alert('수정 실패');
    }
  });
}
// 삭제 버튼 예시
const deleteBtns = document.querySelectorAll('.btn-danger[data-id]');
deleteBtns.forEach(btn => {
  btn.addEventListener('click', async function() {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const id = btn.getAttribute('data-id');
    const res = await fetch(`/api/voca/${id}`, {method: 'DELETE'});
    if (res.ok) location.reload();
    else alert('삭제 실패');
  });
}); 