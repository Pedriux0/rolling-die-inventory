// Asks for confirmation before a delete form is submitted.
// The title comes from a data- attribute (escaped by Mustache) and is
// never written into inline JavaScript, so a title containing quotes
// cannot break out and run code.
document.querySelectorAll('.delete-form').forEach((form) => {
  form.addEventListener('submit', (event) => {
    const ok = window.confirm(`Delete "${form.dataset.title}"? This cannot be undone.`);
    if (!ok) event.preventDefault();
  });
});
