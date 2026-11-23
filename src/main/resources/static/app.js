const list = document.getElementById('messageList');
const emptyList = document.getElementById('emptyList');
const messageView = document.getElementById('messageView');
const replyBtn = document.getElementById('replyBtn');
const backdrop = document.getElementById('composerBackdrop');
const recipient = document.getElementById('recipient');
const subject = document.getElementById('subject');
const content = document.getElementById('content');
let activeMessage = null;
let activeFolder = 'inbox';
let activeDraftId = null;
let draftSaveTimer = null;

async function loadMessages() {
  const response = await fetch(`/api/messages?folder=${activeFolder}`);
  const messages = await response.json();
  list.innerHTML = '';
  emptyList.hidden = messages.length > 0;
  emptyList.style.display = messages.length > 0 ? 'none' : 'flex';
  emptyList.querySelector('h2').textContent = activeFolder === 'sent' ? 'Nenhuma mensagem enviada' : activeFolder === 'draft' ? 'Nenhum rascunho' : 'Sua caixa está vazia';
  emptyList.querySelector('p').textContent = activeFolder === 'sent' ? 'Mensagens enviadas aparecerão aqui.' : activeFolder === 'draft' ? 'Suas mensagens não enviadas aparecerão aqui.' : 'Novas mensagens aparecerão aqui.';

  const sentResponse = await fetch('/api/messages?folder=sent');
  const sentMessages = await sentResponse.json();
  const draftResponse = await fetch('/api/drafts');
  const draftMessages = await draftResponse.json();
  document.getElementById('unreadCount').textContent = activeFolder === 'inbox' ? messages.length : '0';
  document.getElementById('sentCount').textContent = sentMessages.length;
  document.getElementById('draftCount').textContent = draftMessages.length;
  document.querySelector('.inbox-header h1').textContent = activeFolder === 'sent' ? 'Enviadas' : activeFolder === 'draft' ? 'Rascunhos' : 'Caixa de entrada';

  messages.slice().reverse().forEach(message => {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const senderLabel = activeFolder === 'sent' ? `Para: ${message.recipient}` : activeFolder === 'draft' ? `Para: ${message.recipient || 'não definido'}` : message.sender;
    card.innerHTML = `<div class="message-card-top"><span class="sender">${escapeHtml(senderLabel)}</span><span class="message-actions"><span class="time">${escapeHtml(message.time)}</span><button type="button" class="delete-message" title="Excluir mensagem" aria-label="Excluir mensagem">Excluir</button></span></div><h3>${escapeHtml(message.subject || '(Sem assunto)')}</h3><div class="preview">${escapeHtml(message.content || 'Sem prévia')}</div>`;
    card.addEventListener('click', () => {
      if (activeFolder === 'draft') openDraft(message);
      else openMessage(message, card);
    });
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') card.click();
    });
    card.querySelector('.delete-message').addEventListener('click', event => {
      event.stopPropagation();
      deleteMessage(message.id);
    });
    list.appendChild(card);
  });
}

function openMessage(message, card) {
  activeMessage = message;
  document.querySelectorAll('.message-card').forEach(item => item.classList.remove('selected'));
  card.classList.add('selected');
  replyBtn.disabled = false;
  const firstName = message.sender.split(/\s|@/)[0];
  const initials = firstName.slice(0, 2).toUpperCase();
  messageView.innerHTML = `
    <article class="opened-message">
      <div class="sender-row">
        <div class="avatar">${escapeHtml(initials)}</div>
        <div class="sender-details">
          <strong>${escapeHtml(message.sender)}</strong>
          <span>${escapeHtml(message.recipient || 'para você')} · ${escapeHtml(message.time)}</span>
        </div>
      </div>
      <h2>${escapeHtml(message.subject)}</h2>
      <div class="message-body">${escapeHtml(message.content || 'Sem conteúdo.')}</div>
    </article>`;
}

replyBtn.addEventListener('click', () => {
  if (!activeMessage) return;
  const replySubject = activeMessage.subject.toLowerCase().startsWith('re:') ? activeMessage.subject : `Re: ${activeMessage.subject}`;
  openComposer(activeMessage.sender, replySubject);
});

function openComposer(defaultRecipient = '', defaultSubject = '') {
  if (!defaultRecipient && !defaultSubject) activeDraftId = null;
  document.getElementById('composerTitle').textContent = defaultRecipient && activeMessage ? 'Responder mensagem' : 'Nova mensagem';
  recipient.value = defaultRecipient;
  subject.value = defaultSubject;
  content.value = '';
  backdrop.hidden = false;
  (defaultRecipient ? subject : recipient).focus();
}

async function closeComposer(save = true) {
  if (save) await saveDraft(false);
  backdrop.hidden = true;
  await loadMessages();
}

const newMessageBtn = document.getElementById('newMessageBtn');
newMessageBtn.addEventListener('click', () => openComposer());
document.getElementById('closeComposer').onclick = () => closeComposer(true);
document.getElementById('discardBtn').onclick = discardDraft;
backdrop.addEventListener('click', event => { if (event.target === backdrop) closeComposer(true); });

document.getElementById('composerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({recipient: recipient.value.trim(), subject: subject.value.trim(), content: content.value, sender:'Você'})
  });
  if (!response.ok) return;
  if (activeDraftId) {
    await fetch(`/api/drafts?id=${encodeURIComponent(activeDraftId)}`, {method:'DELETE'});
    activeDraftId = null;
  }
  closeComposer(false);
  await loadMessages();
});

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function clearSelection() {
  activeMessage = null;
  document.querySelectorAll('.message-card').forEach(item => item.classList.remove('selected'));
  replyBtn.disabled = true;
  messageView.innerHTML = `
    <div class="view-empty">
      <div class="view-empty-mark">✉</div>
      <p>Selecione uma mensagem para visualizar</p>
    </div>`;
}

const inboxPanel = document.querySelector('.inbox-panel');
inboxPanel.addEventListener('click', event => {
  if (!event.target.closest('.message-card')) clearSelection();
});

function switchFolder(folder) {
  activeFolder = folder;
  clearSelection();
  document.querySelectorAll('.folder').forEach(button => button.classList.remove('active'));
  document.getElementById(folder === 'sent' ? 'sentFolder' : folder === 'draft' ? 'draftsFolder' : 'inboxFolder').classList.add('active');
  loadMessages();
}

document.getElementById('inboxFolder').onclick = () => switchFolder('inbox');
document.getElementById('sentFolder').onclick = () => switchFolder('sent');
document.getElementById('draftsFolder').onclick = () => switchFolder('draft');
recipient.addEventListener('input', scheduleDraftSave);
subject.addEventListener('input', scheduleDraftSave);
content.addEventListener('input', scheduleDraftSave);

loadMessages();

async function saveDraft(showInFolder = false) {
  const hasContent = recipient.value.trim() || subject.value.trim() || content.value.trim();
  if (!hasContent) return;
  const response = await fetch('/api/drafts', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      id: activeDraftId,
      recipient: recipient.value.trim(),
      subject: subject.value.trim(),
      content: content.value.trim()
    })
  });
  if (response.ok) {
    const saved = await response.json();
    activeDraftId = saved.id;
    if (showInFolder) await loadMessages();
  }
}

function scheduleDraftSave() {
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => saveDraft(false), 500);
}

function openDraft(draft) {
  activeDraftId = draft.id;
  recipient.value = draft.recipient || '';
  subject.value = draft.subject || '';
  content.value = draft.content || '';
  document.getElementById('composerTitle').textContent = 'Editar rascunho';
  backdrop.hidden = false;
  recipient.focus();
}

async function discardDraft() {
  if (activeDraftId) {
    await fetch(`/api/drafts?id=${encodeURIComponent(activeDraftId)}`, {method:'DELETE'});
    activeDraftId = null;
  }
  closeComposer(false);
  await loadMessages();
}

async function deleteMessage(id) {
  if (!id) return;
  if (activeFolder === 'draft') {
    await fetch(`/api/drafts?id=${encodeURIComponent(id)}`, {method:'DELETE'});
  } else {
    const folderQuery = activeFolder === 'sent' ? '&folder=sent' : '';
    await fetch(`/api/messages?id=${encodeURIComponent(id)}${folderQuery}`, {method:'DELETE'});
  }
  if (activeMessage && activeMessage.id === id) clearSelection();
  if (activeDraftId === id) activeDraftId = null;
  await loadMessages();
}
