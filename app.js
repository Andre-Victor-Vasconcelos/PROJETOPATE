// ATENÇÃO: Insira suas chaves do Supabase aqui
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANONIMA';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// Duplicar opções de estados (Auxiliar)
document.getElementById('reg-des-state').innerHTML = document.getElementById('reg-curr-state').innerHTML;
document.getElementById('reg-des-state').options[0].text = "Estado Desejado";

// Controle de Navegação (SPA)
function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId + '-view').classList.add('active');
    
    if (viewId === 'search') loadPublicProfiles();
    if (viewId === 'matches') loadMatches();
    if (viewId === 'profile') loadMyProfile();
}

// Escutando mudanças de Autenticação
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        document.getElementById('nav-links').style.display = 'flex';
        document.getElementById('btn-start').style.display = 'none';
        showView('search'); // Redireciona ao logar
        checkMatchCount();
    } else {
        currentUser = null;
        document.getElementById('nav-links').style.display = 'none';
        document.getElementById('btn-start').style.display = 'inline-block';
        showView('home');
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Erro no login: ' + error.message);
});

// Cadastro (Auth + Inserção no Perfil)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Auth
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) return alert('Erro ao criar conta: ' + authError.message);
    
    const userId = authData.user.id;

    // Inserindo dados Públicos
    const { error: pubError } = await supabase.from('public_profiles').insert({
        id: userId,
        current_org: document.getElementById('reg-curr-org').value,
        current_state: document.getElementById('reg-curr-state').value,
        desired_state: document.getElementById('reg-des-state').value,
        desired_org: document.getElementById('reg-des-org').value,
        status: document.getElementById('reg-status').value
    });

    // Inserindo dados Privados
    const { error: privError } = await supabase.from('private_details').insert({
        id: userId,
        full_name: document.getElementById('reg-name').value,
        email: email,
        phone: document.getElementById('reg-phone').value
    });

    if (pubError || privError) {
        alert("Conta criada, mas houve erro ao salvar o perfil. Edite seu perfil depois.");
        console.error(pubError, privError);
    } else {
        alert("Cadastro realizado com sucesso!");
    }
});

// Logout
async function logout() {
    await supabase.auth.signOut();
}

// Carregar Perfis Públicos (Anonimizados)
async function loadPublicProfiles() {
    const list = document.getElementById('public-profiles-list');
    list.innerHTML = 'Carregando...';

    const { data, error } = await supabase.from('public_profiles').select('*').neq('id', currentUser.id);
    if (error) return list.innerHTML = 'Erro ao carregar perfis.';
    if (data.length === 0) return list.innerHTML = 'Nenhum perfil encontrado.';

    list.innerHTML = data.map(p => `
        <div class="card">
            <h3>Perfil #${p.id.substring(0, 6).toUpperCase()}</h3>
            <p><strong>De:</strong> ${p.current_org} / ${p.current_state}</p>
            <p><strong>Para:</strong> ${p.desired_org || 'Qualquer'} / ${p.desired_state}</p>
            <p><strong>Situação:</strong> ${p.status}</p>
            <span class="tag">Dados Protegidos</span>
        </div>
    `).join('');
}

// Carregar Matches Automaticamente via View (Bypass RLS com segurança do lado do BD)
async function loadMatches() {
    const list = document.getElementById('matches-list');
    list.innerHTML = 'Buscando matches...';

    const { data, error } = await supabase.from('user_matches').select('*');
    if (error) return list.innerHTML = 'Erro ao carregar matches.';
    
    if (data.length === 0) {
        list.innerHTML = 'Você ainda não possui matches. Quando alguém do estado que você deseja tiver interesse no seu estado atual, aparecerá aqui.';
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

// Checar Notificação de Matches
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

// Carregar Meu Perfil
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
