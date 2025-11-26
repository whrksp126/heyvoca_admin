document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    if (!form) return;
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const data = new URLSearchParams(formData);
        const response = await fetch('/login/', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            },
            body: data
        });
        const result = await response.json();
        if (result.success) {
            window.location.href = result.redirect;
        } else {
            alert(result.message);
        }
    });
}); 