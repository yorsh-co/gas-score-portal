/** Brazilian Portuguese catalogue; it must define every `en` key. */
const MESSAGES_PT_BR: Messages = {
  'menu.root': '🔶 Sistema de Notas',
  'menu.settings': '⚙️ Configurações',
  'menu.openSettings': '🛠️ Abrir as configurações',
  'menu.install': '💽 Instalar o Script',
  'menu.uninstall': '💿 Desinstalar o Script',
  'menu.systemReset': '⛔ Reset do Sistema',
  'menu.forms': '🟪 Forms',
  'menu.importDrive': '✔️ Importar do Drive',
  'menu.linkForm': '➕ Adicionar Forms individual',
  'menu.removeForms': '➖ Remover Forms selecionado(s)',

  'toast.busy': 'Ocupado...',
  'toast.loading': 'Carregando...',
  'toast.ready': 'Pronto',
  'toast.success': 'Sucesso',
  'toast.warning': 'Alerta',
  'toast.error': 'Erro',

  'prompt.default': 'Insira o {title}',
  'prompt.notBlank': 'Esse campo não pode ficar vazio',

  'error.cancelled': 'Cancelado pelo usuário',
  'error.syncRunning':
    'Há uma sincronização em andamento. Tente novamente em instantes.',
  'error.settingsConflict':
    'As configurações foram alteradas nesse meio tempo. Tente novamente.',
  'error.fileInaccessible': 'Não foi possível acessar o arquivo',
  'error.respondentNotFound': 'Respondente não encontrado',

  'install.installing': 'Instalando o Script',
  'install.triggersInstalled': 'Os acionadores foram instalados.',
  'install.timeZoneTitle': 'Fuso horário configurado para {timeZone}',
  'install.timeZoneBody': 'Acesse o editor do Apps Script para alterar',
  'install.creatingOverview': 'Criando a planilha Overview',
  'install.installed': 'O Script foi instalado',

  'uninstall.title': '⚠️ Desinstalar',
  'uninstall.body':
    'Isso removerá todos os acionadores e excluirá todos os valores armazenados, como chaves de API e configurações.\n\nEsta ação só pode ser revertida reinstalando o script pelo menu.\n\n🆗 Clique em OK para desinstalar.',
  'uninstall.toastTitle': 'Desinstalando',
  'uninstall.removingTriggers': 'Removendo os acionadores',
  'uninstall.deletingProperties':
    'Excluindo as propriedades e configurações armazenadas',
  'uninstall.complete': 'Desinstalação concluída',

  'reset.title': '⛔ Reset do Sistema',
  'reset.body':
    '⚠️ Zona de perigo!\n\nTodos os Forms e as Notas serão removidos do sistema. Além disso, as permissões do script serão revertidas. Para reinicar o sistema, você deverá seguir todas as etapas de instalação, após o reset.\n\n👉 Clique em OK para continuar.',
  'reset.resetting': 'Resetando...',

  'forms.wrongSheet': 'Esta ação é possível apenas a partir da aba {sheetName}',
  'forms.noneSelected': 'Nenhum Forms selecionado',
  'forms.imported': 'Forms importados',
  'forms.linkTitle': '➕ Adicionar Forms individual',
  'forms.linkPrompt':
    'Insira o URL do arquivo Forms a ser vinculado ao sistema.',
  'forms.accessWarning':
    'Não foi possível acessar o Forms "{url}". Verifique se você tem permissão para acessar a arquivo.',
  'forms.reactivateTitle': '➕ Reativar Forms',
  'forms.reactivateBody':
    'O Forms "{title}" consta na lista de Forms removidos.\n\n👉 Clique em OK para reativar esse Forms.',
  'forms.linking': 'Vinculando "{title}"...',
  'forms.linked': '"{title}" vinculado',
  'forms.removeTitle': '➖ Remover Forms',
  'forms.removeBody':
    'Os Forms abaixo serão removidos do sistema e ignorados durante a sincronização das notas:\n\n{list}\nPara reativar um desses Forms, utilize o botão "➕ Adicionar Forms individual".\n\n👉 Clique em OK para continuar.',
  'forms.removing': 'Removendo {count} Forms...',
  'forms.removed': 'Forms removidos',

  'importer.searching': 'Buscando Forms no Drive',
  'importer.importing': 'Importando {count} novos Forms',
  'importer.folderRequired':
    'O URL da pasta é obrigatório. Informe o URL da pasta do Drive nas configurações.',
  'importer.folderAccessWarning':
    'Não foi possível acessar a pasta em "{url}". Verifique se você tem permissão para acessar a pasta.',
  'importer.promptTitle': '🟪 Importar Forms do Drive',
  'importer.promptBody':
    'Insira o URL da pasta do Drive que contém os Forms a serem vinculados ao sistema.\n\nDeixe vazio para importar Forms de todo o Drive.\n\n👉 Observações:\n- Apenas Forms que correspondam às configurações serão importados.\n- Novos Forms na pasta serão importados automaticamente em até 60 minutos.',

  'portal.emailPlaceholder': 'Insira o e-mail utilizado nas checagens',
  'portal.loadButton': 'Visualize suas notas',
  'portal.labelName': 'Nome',
  'portal.labelUsers': 'Usuário(s)',
  'portal.labelResponses': 'Respostas',
  'portal.labelAverage': 'Nota média',
  'portal.labelForm': 'Módulo',
  'portal.labelScore': 'Nota',
  'portal.empty': 'Nenhuma nota encontrada.',
  'portal.note':
    'Novas notas poderão ser visualizadas em até uma hora após o envio do formulário.',
  'portal.updatedAt': 'Atualizada em {date}.',
  'portal.notAnswered': 'Não respondido',
  'portal.emailRequired': 'Insira seu e-mail.',
  'portal.emailInvalid': 'Insira um e-mail válido.',
  'portal.serverError': 'Erro do servidor. Tente novamente.',

  'auth.otpRequested':
    'Se este email estiver cadastrado, um código foi enviado. Ele expira em {minutes} minutos.',
  'auth.invalidEmail': 'Informe um email válido.',
  'auth.invalidCode': 'Código inválido ou expirado.',
  'auth.sessionInvalid': 'Sua sessão expirou. Entre novamente.',
  'auth.tryLater':
    'Não foi possível enviar o código agora. Tente novamente mais tarde.',

  'email.otpSubject': '{portalTitle}: seu código de acesso',
  'email.otpIntro': 'Seu código de acesso ao {portalTitle} é:',
  'email.otpExpiry':
    'Ele expira em {minutes} minutos e só pode ser usado uma vez. Se você não o solicitou, ignore este email.',
};
