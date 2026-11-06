// ==========================================
// ATENÇÃO: COLOQUE SUAS CHAVES DO SUPABASE AQUI
// ==========================================
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_AQUI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// Garante que o HTML carregou antes de mexer na tela
document.addEventListener("DOMContentLoaded", () => {
    const currState = document.getElementById('reg-curr-state');
    const desState = document.getElementById('reg-des-state');
    if (currState && desState) {
        desState.innerHTML = currState.innerHTML;
        desState.options[0].text = "Estado Desejado";
    }
});

// ==========================================
// CONTROLE DE NAVEGAÇÃO DAS TELAS
// ==========================================
function showView(viewId) {
    // Esconde todas as telas
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Mostra a tela que o usuário clicou
    const tela = document.getElementById(viewId + '-view');
    if (tela) {
        tela.classList.add('active');
    }
    
    // Carrega os dados correspondentes da tela
    if (viewId === 'search') loadPublicProfiles();
    if (viewId === 'matches') loadMatches();
    if (viewId === 'profile') loadMyProfile();
}

// ==========================================
// ESCUTANDO LOGIN E LOGOUT
// ==========================================
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        // Usuário está LOGADO
        currentUser = session.user;
        document.body.classList.add('logged-in'); 
        
        // Se acabou de fazer login e estava na tela de auth, vai para a busca
        const authView = document.getElementById('auth-view');
        if (authView && authView.classList.contains('active')) {
            showView('search');
        }
        checkMatchCount();
    } else {
        // Usuário é VISITANTE
        currentUser = null;
        document.body.classList.remove('logged-in'); 
        
        // Se não tiver nenhuma tela aberta, mostra o Início
        if (!document.querySelector('.view.active')) {
            showView('home');
        }
    }
});

// ==========================================
// FORMULÁRIOS DE LOGIN E CADASTRO
// ==========================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Erro no login: ' + error.message);
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    // Cria o usuário
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return alert('Erro ao criar conta: ' + authError.message);
    
    const userId = authData.user.id;

    // Salva os dados Públicos
    const { error: pubError } = await supabase.from('public_profiles').insert({
        id: userId,
        current_org: document.getElementById('reg-curr-org').value,
        current_state: document.getElementById('reg-curr-state').value,
        desired_state: document.getElementById('reg-des-state').value,
        desired_org: document.getElementById('reg-des-org').value,
        status: document.getElementById('reg-status').value
    });

    // Salva os dados Privados
    const { error: privError } = await supabase.from('private_details').insert({
        id: userId,
        full_name: document.getElementById('reg-name').value,
        email: email,
        phone: document.getElementById('reg-phone').value
    });

    if (pubError || privError) {
        alert("Conta criada, mas houve erro ao salvar o perfil. Edite seu perfil depois.");
        console.log(pubError, privError);
    } else {
        alert("Cadastro realizado com sucesso! Faça login.");
        document.getElementById('login-email').value = email;
    }
});

async function logout() {
    await supabase.auth.signOut();
    showView('home');
}

// ==========================================
// FUNÇÕES DE BUSCA NO BANCO DE DADOS
// ==========================================

// 1. Carrega todos os perfis (Visitantes e Logados)
async function loadPublicProfiles() {
    const list = document.getElementById('public-profiles-list');
    list.innerHTML = 'Carregando...';

    // Se estiver logado, oculta o próprio perfil. Se for visitante, busca todos.
    let query = supabase.from('public_profiles').select('*');
    if (currentUser) {
        query = query.neq('id', currentUser.id);
    }

    const { data, error } = await query;
    if (error) return list.innerHTML = 'Erro ao carregar perfis: ' + error.message;
    if (data.length === 0) return list.innerHTML = 'Nenhum perfil cadastrado ainda.';

    list.innerHTML = data.map(p => `
        <div class="card">
            <h3>Perfil #${p.id.substring(0, 6).toUpperCase()}</h3>
            <p><strong>De:</strong> ${p.current_org} / ${p.current_state}</p>
            <p><strong>Para:</strong> ${p.desired_org || 'Qualquer'} / ${p.desired_state}</p>
            <p><strong>Situação:</strong> ${p.status}</p>
            <span class="tag">Contatos Ocultos</span>
        </div>
    `).join('');
}

// 2. Carrega Matchs Automáticos (Só para logados)
async function loadMatches() {
    const list = document.getElementById('matches-list');
    list.innerHTML = 'Buscando matches...';

    const { data, error } = await supabase.from('user_matches').select('*');
    if (error) return list.innerHTML = 'Erro ao carregar matches.';
    
    if (data.length === 0) {
        list.innerHTML = 'Você ainda não possui matches. Quando houver reciprocidade no seu estado desejado, os contatos aparecerão aqui.';
        return;
    }

    list.innerHTML = data.map(m => `
        <div class="card match-card">
            <div class="match-badge">✓ MATCH CONFIRMADO</div>
            <h3>${m.full_name || 'Nome Indisponível'}</h3>
            <p><strong>De:</strong> ${m.current_org} / ${m.current_state}</p>
            <p><strong>Para:</strong> ${m.desired_org || 'Qualquer'} / ${m.desired_state}</p>
            <hr>
            <p>📧 ${m.email}</p>
            <p>📱 ${m.phone}</p>
            <span class="tag">${m.status}</span>
        </div>
    `).join('');
}

// 3. Verifica o número de Matches (Notificação)
async function checkMatchCount() {
    const { data } = await supabase.from('user_matches').select('match_id');
    const badge = document.getElementById('match-badge');
    if (data && data.length > 0) {
        badge.textContent = `(${data.length})`;
        badge.style.color = 'var(--success)';
        badge.style.fontWeight = 'bold';
    } else {
        badge.textContent = '';
    }
}

// 4. Carrega Perfil do Usuário
async function loadMyProfile() {
    const div = document.getElementById('my-profile-info');
    div.innerHTML = 'Carregando...';

    const { data: pub } = await supabase.from('public_profiles').select('*').eq('id', currentUser.id).single();
    const { data: priv } = await supabase.from('private_details').select('*').eq('id', currentUser.id).single();

    if (!pub || !priv) return div.innerHTML = 'Perfil não encontrado.';

    div.innerHTML = `
        <div class="card">
            <h3>${priv.full_name}</h3>
            <p><strong>Email:</strong> ${priv.email} | <strong>Telefone:</strong> ${priv.phone}</p>
            <hr>
            <p><strong>Órgão Atual:</strong> ${pub.current_org} - ${pub.current_state}</p>
            <p><strong>Deseja ir para:</strong> ${pub.desired_org || 'Qualquer'} - ${pub.desired_state}</p>
            <p><strong>Situação:</strong> ${pub.status}</p>
        </div>
    `;
}
