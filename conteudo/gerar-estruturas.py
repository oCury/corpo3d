#!/usr/bin/env python3
"""Gera a versão INICIAL de conteudo/estruturas.csv a partir das listas do BodyParts3D.

Rodado uma vez em 2026-09-21. Depois disso o CSV é a fonte da verdade e é editado à mão;
este script fica só como registro de proveniência (de onde veio cada ID) e para
regenerar do zero se for preciso. Precisa das listas em .cache/bp3d/ (ver pipeline).
"""
import csv, sys
import os
BP = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.cache', 'bp3d')  # listas baixadas pelo pipeline (pnpm --filter pipeline baixar)
def lista(f):
    m = {}
    for l in open(f'{BP}/{f}', encoding='utf-8').read().splitlines()[1:]:
        c = l.split('\t')
        if len(c) >= 3: m.setdefault(c[2].strip(), c[0].strip())
    return m
L = {'partof': lista('partof_parts_list_e.txt'), 'isa': lista('isa_parts_list_e.txt')}
rows, miss, avisos = [], [], []
def rid(arv, en, obrig=True):
    i = L[arv].get(en)
    if i is None:
        outra = 'isa' if arv == 'partof' else 'partof'
        i = L[outra].get(en)
        if i is not None: avisos.append(f'{en}: veio de {outra}, não de {arv}'); return i, outra
        else: (miss if obrig else avisos).append(f'{arv}:{en}')
    return i, arv
def add(en, arv, latim, pt, leigo, sistema, lado='-', extras=(), excluir=(), razao='', vetor=''):
    i, arv = rid(arv, en)
    ex = [x for x, _ in (rid(arv, e, obrig=False) for e in extras) if x]
    exc = [x for x, _ in (rid(arv, e) for e in excluir) if x]
    if i: rows.append([i, arv, ';'.join(ex), ';'.join(exc), latim, pt, leigo, sistema, lado, vetor, razao])
def bil(en, arv, latim, pt, gen, leigo, lgen, sistema, extras=(), razao='', prefixo=True):
    # prefixo=True -> "right X"; False -> "X of right ..." não usado
    for side, en_side, ptS, code in (('right','right ', {'m':'direito','f':'direita','mp':'direitos','fp':'direitas'}, 'D'),
                                    ('left','left ', {'m':'esquerdo','f':'esquerda','mp':'esquerdos','fp':'esquerdas'}, 'E')):
        add(en.replace('{s}', side) if '{s}' in en else f'{en_side}{en}', arv, latim, f'{pt} {ptS[gen]}', f'{leigo} {ptS[lgen]}', sistema, code,
            extras=tuple(e.replace('{s}', side) for e in extras), razao=razao)

# ---------- PELE
add('skin','partof','Cutis','Pele','pele','pele', razao='0.3')

# ---------- ESQUELETO
add('skull','partof','Cranium','Crânio','crânio (ossos da cabeça, sem o maxilar inferior)','esqueleto', excluir=('mandible',), razao='0.3')
add('mandible','partof','Mandibula','Mandíbula','maxilar inferior (osso do queixo)','esqueleto')
add('hyoid bone','partof','Os hyoideum','Osso hioide','osso hioide (na frente do pescoço)','esqueleto')
add('atlas','partof','Atlas (C I)','Atlas (C1)','1ª vértebra do pescoço','esqueleto')
add('axis','partof','Axis (C II)','Áxis (C2)','2ª vértebra do pescoço','esqueleto')
ORD = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth']
ROM = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
for n in range(3,8):
    add(f'{ORD[n-1]} cervical vertebra','partof',f'Vertebra cervicalis {ROM[n-1]}',f'Vértebra cervical C{n}',f'{n}ª vértebra do pescoço','esqueleto')
for n in range(1,13):
    add(f'{ORD[n-1]} thoracic vertebra','partof',f'Vertebra thoracica {ROM[n-1]}',f'Vértebra torácica T{n}',f'{n}ª vértebra das costas (altura do tórax)','esqueleto')
for n in range(1,6):
    add(f'{ORD[n-1]} lumbar vertebra','partof',f'Vertebra lumbalis {ROM[n-1]}',f'Vértebra lombar L{n}',f'{n}ª vértebra da lombar','esqueleto')
add('sacrum','partof','Os sacrum','Sacro','sacro (osso da base da coluna)','esqueleto')
add('sternum','partof','Sternum','Esterno','osso do peito','esqueleto')
for n in range(1,13):
    for side, code, ptS in (('right','D','direita'),('left','E','esquerda')):
        add(f'{side} {ORD[n-1]} rib','partof',f'Costa {ROM[n-1]}',f'{n}ª costela {ptS}',f'{n}ª costela do lado {"direito" if code=="D" else "esquerdo"}','esqueleto',code)
for side, code, ptS in (('right','D','direitas'),('left','E','esquerdas')):
    add(f'{side} first costal cartilage','partof','Cartilagines costales',f'Cartilagens costais {ptS}',f'cartilagens que ligam as costelas ao osso do peito (lado {"direito" if code=="D" else "esquerdo"})','esqueleto',code,
        extras=tuple(f'{side} {ORD[k]} costal cartilage' for k in range(1,7)))
bil('clavicle','partof','Clavicula','Clavícula','f','clavícula','f','esqueleto')
bil('scapula','partof','Scapula','Escápula','f','omoplata','f','esqueleto')
bil('humerus','partof','Humerus','Úmero','m','osso do braço','m','esqueleto')
bil('radius','partof','Radius','Rádio','m','osso do antebraço (lado do polegar)','m','esqueleto')
bil('ulna','partof','Ulna','Ulna','f','osso do antebraço (lado do mindinho)','f','esqueleto')
bil('hand','partof','Ossa manus','Ossos da mão','f','ossos da mão','f','esqueleto',
    extras=('{s} scaphoid','{s} lunate','{s} triquetral','{s} pisiform','{s} trapezium','{s} trapezoid','{s} capitate','{s} hamate'))
bil('hip bone','partof','Os coxae','Osso do quadril','m','osso da bacia','m','esqueleto')
bil('femur','partof','Femur','Fêmur','m','osso da coxa','m','esqueleto')
bil('patella','partof','Patella','Patela','f','rótula do joelho','f','esqueleto')
bil('tibia','partof','Tibia','Tíbia','f','canela','f','esqueleto')
bil('fibula','partof','Fibula','Fíbula','f','osso fino da perna','m','esqueleto')
bil('foot','partof','Ossa pedis','Ossos do pé','m','ossos do pé','m','esqueleto')

# ---------- MÚSCULOS
bil('sternocleidomastoid','isa','Musculus sternocleidomastoideus','Esternocleidomastóideo','m','músculo lateral do pescoço','m','musculos')
bil('descending part of {s} trapezius','isa','Musculus trapezius','Trapézio','m','músculo do ombro e da nuca','m','musculos',
    extras=('transverse part of {s} trapezius','ascending part of {s} trapezius'))
bil('acromial part of {s} deltoid','isa','Musculus deltoideus','Deltoide','m','músculo do ombro','m','musculos',
    extras=('clavicular part of {s} deltoid','spinal part of {s} deltoid'))
bil('pectoralis major','partof','Musculus pectoralis major','Peitoral maior','m','músculo do peito','m','musculos')
bil('pectoralis minor','partof','Musculus pectoralis minor','Peitoral menor','m','músculo pequeno sob o peito','m','musculos')
bil('serratus anterior','partof','Musculus serratus anterior','Serrátil anterior','m','músculo lateral do tórax','m','musculos')
bil('external oblique','partof','Musculus obliquus externus abdominis','Oblíquo externo','m','músculo lateral do abdome','m','musculos')
bil('rhomboid major','partof','Musculus rhomboideus major','Romboide maior','m','músculo entre as omoplatas','m','musculos')
bil('levator scapulae','partof','Musculus levator scapulae','Levantador da escápula','m','músculo que levanta a omoplata','m','musculos')
bil('long head of {s} biceps brachii','isa','Musculus biceps brachii','Bíceps braquial','m','bíceps (frente do braço)','m','musculos',
    extras=('short head of {s} biceps brachii',))
bil('long head of {s} triceps brachii','isa','Musculus triceps brachii','Tríceps braquial','m','tríceps (parte de trás do braço)','m','musculos',
    extras=('lateral head of {s} triceps brachii','medial head of {s} triceps brachii'))
bil('brachialis','isa','Musculus brachialis','Braquial','m','músculo profundo da frente do braço','m','musculos')
bil('brachioradialis','isa','Musculus brachioradialis','Braquiorradial','m','músculo do antebraço (lado do polegar)','m','musculos')
bil('gluteus maximus','isa','Musculus gluteus maximus','Glúteo máximo','m','músculo da nádega','m','musculos')
bil('gluteus medius','isa','Musculus gluteus medius','Glúteo médio','m','músculo lateral do quadril','m','musculos')
bil('iliacus','isa','Musculus iliacus','Ilíaco','m','músculo interno da bacia','m','musculos')
bil('psoas major','partof','Musculus psoas major','Psoas maior','m','músculo profundo entre a lombar e a coxa','m','musculos')
bil('rectus femoris','isa','Musculus quadriceps femoris','Quadríceps femoral','m','músculo da frente da coxa','m','musculos',
    extras=('{s} vastus lateralis','{s} vastus medialis','{s} vastus intermedius'))
bil('sartorius','isa','Musculus sartorius','Sartório','m','músculo longo que cruza a coxa','m','musculos')
bil('adductor magnus','isa','Musculi adductores','Adutores da coxa','mp','músculos internos da coxa','mp','musculos',
    extras=('{s} adductor longus','{s} adductor brevis','{s} gracilis'))
bil('semitendinosus','isa','Musculi ischiocrurales','Isquiotibiais','mp','músculos de trás da coxa','mp','musculos',
    extras=('{s} semimembranosus','long head of {s} biceps femoris','short head of {s} biceps femoris'))
bil('medial head of {s} gastrocnemius','isa','Musculus gastrocnemius','Gastrocnêmio','m','panturrilha (batata da perna)','f','musculos',
    extras=('lateral head of {s} gastrocnemius',))
bil('soleus','isa','Musculus soleus','Sóleo','m','músculo profundo da panturrilha','m','musculos')
bil('tibialis anterior','isa','Musculus tibialis anterior','Tibial anterior','m','músculo da frente da canela','m','musculos')
bil('fibularis longus','isa','Musculus fibularis longus','Fibular longo','m','músculo lateral da perna','m','musculos')
bil('iliocostalis lumborum','isa','Musculus erector spinae','Eretor da espinha','m','músculos ao longo da coluna','mp','musculos',
    extras=('{s} iliocostalis thoracis','{s} iliocostalis cervicis','{s} longissimus thoracis','{s} longissimus cervicis','{s} longissimus capitis','{s} spinalis thoracis'))
add('diaphragm','partof','Diaphragma','Diafragma','músculo da respiração (separa tórax e abdome)','musculos')
add('intercostal muscle','isa','Musculi intercostales','Músculos intercostais','músculos entre as costelas','musculos', razao='0.15')

# ---------- CARDIOVASCULAR
add('heart','partof','Cor','Coração','coração','cardiovascular')
add('aorta','partof','Aorta','Aorta','aorta (principal artéria do corpo)','cardiovascular')
add('pulmonary trunk','partof','Truncus pulmonalis','Tronco pulmonar','artéria que sai do coração para os pulmões','cardiovascular')
bil('pulmonary artery','partof','Arteria pulmonalis','Artéria pulmonar','f','artéria do pulmão','f','cardiovascular')
add('superior vena cava','partof','Vena cava superior','Veia cava superior','veia que traz o sangue da cabeça e dos braços ao coração','cardiovascular')
add('inferior vena cava','partof','Vena cava inferior','Veia cava inferior','veia que traz o sangue das pernas e do abdome ao coração','cardiovascular')
add('brachiocephalic artery','partof','Truncus brachiocephalicus','Tronco braquiocefálico','artéria que sai da aorta para o lado direito da cabeça e do braço','cardiovascular')
bil('common carotid artery','partof','Arteria carotis communis','Artéria carótida comum','f','carótida (artéria do pescoço)','f','cardiovascular')
bil('internal carotid artery','partof','Arteria carotis interna','Artéria carótida interna','f','artéria que leva sangue ao cérebro','f','cardiovascular')
bil('subclavian artery','partof','Arteria subclavia','Artéria subclávia','f','artéria sob a clavícula, que segue para o braço','f','cardiovascular')
bil('vertebral artery','partof','Arteria vertebralis','Artéria vertebral','f','artéria que sobe pela coluna do pescoço até o cérebro','f','cardiovascular')
add('basilar artery','partof','Arteria basilaris','Artéria basilar','artéria na base do cérebro','cardiovascular')
add('cerebral arterial circle','partof','Circulus arteriosus cerebri','Círculo arterial do cérebro','anel de artérias na base do cérebro (polígono de Willis)','cardiovascular')
bil('internal jugular vein','partof','Vena jugularis interna','Veia jugular interna','f','jugular (veia do pescoço)','f','cardiovascular')
bil('coronary artery','partof','Arteria coronaria','Artéria coronária','f','artéria que irriga o próprio coração','f','cardiovascular')
add('celiac trunk','partof','Truncus coeliacus','Tronco celíaco','artéria do estômago, fígado e baço','cardiovascular')
add('superior mesenteric artery','partof','Arteria mesenterica superior','Artéria mesentérica superior','artéria do intestino delgado','cardiovascular')
add('inferior mesenteric artery','partof','Arteria mesenterica inferior','Artéria mesentérica inferior','artéria do intestino grosso','cardiovascular')
add('hepatic portal vein','partof','Vena portae hepatis','Veia porta','veia que leva o sangue do intestino ao fígado','cardiovascular')
bil('renal artery','partof','Arteria renalis','Artéria renal','f','artéria do rim','f','cardiovascular')
bil('renal vein','isa','Vena renalis','Veia renal','f','veia do rim','f','cardiovascular')
bil('common iliac artery','partof','Arteria iliaca communis','Artéria ilíaca comum','f','artéria da bacia','f','cardiovascular')
bil('femoral artery','partof','Arteria femoralis','Artéria femoral','f','artéria da coxa','f','cardiovascular')
bil('popliteal artery','partof','Arteria poplitea','Artéria poplítea','f','artéria de trás do joelho','f','cardiovascular')
bil('brachial artery','partof','Arteria brachialis','Artéria braquial','f','artéria do braço','f','cardiovascular')
bil('femoral vein','isa','Vena femoralis','Veia femoral','f','veia profunda da coxa','f','cardiovascular')
bil('great saphenous vein','isa','Vena saphena magna','Veia safena magna','f','safena (veia superficial da perna)','f','cardiovascular')
add('azygos vein','partof','Vena azygos','Veia ázigo','veia ao lado da coluna, no tórax','cardiovascular')

# ---------- RESPIRATÓRIO
add('trachea','partof','Trachea','Traqueia','traqueia (tubo de ar do pescoço ao peito)','respiratorio')
bil('main bronchus','partof','Bronchus principalis','Brônquio principal','m','brônquio (tubo de ar que entra no pulmão)','m','respiratorio')
bil('lung','partof','Pulmo','Pulmão','m','pulmão','m','respiratorio', razao='0.4')

# ---------- DIGESTIVO
add('tongue','partof','Lingua','Língua','língua','digestivo')
bil('submandibular gland','isa','Glandula submandibularis','Glândula submandibular','f','glândula de saliva sob o maxilar','f','digestivo')
add('esophagus','partof','Oesophagus','Esôfago','esôfago (tubo que leva o alimento ao estômago)','digestivo')
add('stomach','partof','Gaster','Estômago','estômago','digestivo')
add('duodenum','partof','Duodenum','Duodeno','duodeno (primeira parte do intestino delgado)','digestivo')
add('jejunum','partof','Jejunum','Jejuno','jejuno (parte média do intestino delgado)','digestivo', razao='0.4')
add('ileum','partof','Ileum','Íleo','íleo (parte final do intestino delgado)','digestivo', razao='0.4')
add('cecum','partof','Caecum','Ceco','ceco (início do intestino grosso)','digestivo')
add('appendix','partof','Appendix vermiformis','Apêndice vermiforme','apêndice','digestivo')
add('ascending colon','partof','Colon ascendens','Cólon ascendente','cólon ascendente (lado direito do intestino grosso)','digestivo')
add('transverse colon','partof','Colon transversum','Cólon transverso','cólon transverso (parte de cima do intestino grosso)','digestivo')
add('descending colon','partof','Colon descendens','Cólon descendente','cólon descendente (lado esquerdo do intestino grosso)','digestivo')
add('rectum','partof','Rectum','Reto','reto (parte final do intestino)','digestivo')
add('liver','partof','Hepar','Fígado','fígado','digestivo', razao='0.4')
add('gallbladder','partof','Vesica biliaris','Vesícula biliar','vesícula (bolsa da bile, sob o fígado)','digestivo')
add('pancreas','partof','Pancreas','Pâncreas','pâncreas','digestivo')

# ---------- LINFÁTICO / IMUNE
add('spleen','isa','Splen','Baço','baço','linfatico')
add('right lobe of thymus','isa','Thymus','Timo','timo (glândula atrás do osso do peito)','linfatico', extras=('left lobe of thymus',))

# ---------- URINÁRIO
bil('kidney','partof','Ren','Rim','m','rim','m','urinario')
bil('ureter','partof','Ureter','Ureter','m','ureter (canal do rim à bexiga)','m','urinario')
add('urinary bladder','partof','Vesica urinaria','Bexiga urinária','bexiga','urinario')

# ---------- REPRODUTOR (masculino)
add('prostate','partof','Prostata','Próstata','próstata','reprodutor')
bil('testis','isa','Testis','Testículo','m','testículo','m','reprodutor')
bil('epididymis','isa','Epididymis','Epidídimo','m','epidídimo (canal enrolado sobre o testículo)','m','reprodutor')
bil('seminal vesicle','isa','Glandula vesiculosa','Vesícula seminal','f','vesícula seminal','f','reprodutor')

# ---------- ENDÓCRINO
add('pituitary gland','partof','Hypophysis','Hipófise','hipófise (glândula na base do cérebro)','endocrino')
bil('adrenal gland','isa','Glandula suprarenalis','Glândula suprarrenal','f','glândula sobre o rim','f','endocrino')

# ---------- NERVOSO
for en, lat, pt, leigo in (('frontal lobe','Lobus frontalis','Lobo frontal','parte da frente do cérebro'),
                            ('parietal lobe','Lobus parietalis','Lobo parietal','parte de cima do cérebro'),
                            ('temporal lobe','Lobus temporalis','Lobo temporal','parte lateral do cérebro'),
                            ('occipital lobe','Lobus occipitalis','Lobo occipital','parte de trás do cérebro'),
                            ('insula','Insula','Ínsula','parte escondida do cérebro, atrás do lobo lateral'),
                            ('limbic lobe','Lobus limbicus','Lobo límbico','parte interna do cérebro')):
    bil(en,'partof',lat,pt,'m',leigo,'m','nervoso', razao='0.35')
add('corpus callosum','isa','Corpus callosum','Corpo caloso','ponte de fibras que liga os dois lados do cérebro','nervoso')
add('cerebellum','partof','Cerebellum','Cerebelo','cerebelo (equilíbrio e coordenação)','nervoso', razao='0.4')
add('brainstem','partof','Truncus encephali','Tronco encefálico','tronco cerebral (liga o cérebro à medula)','nervoso')
add('diencephalon','partof','Diencephalon','Diencéfalo','centro do cérebro (tálamo e hipotálamo)','nervoso')
add('spinal cord','partof','Medulla spinalis','Medula espinal','medula (cordão de nervos dentro da coluna)','nervoso')
bil('optic nerve','isa','Nervus opticus','Nervo óptico','m','nervo da visão','m','nervoso')

# ---------- OLHO
bil('cornea','partof','Cornea','Córnea','f','córnea (janela transparente da frente do olho)','f','olho')
bil('sclera','partof','Sclera','Esclera','f','parte branca do olho','f','olho')
bil('iris','partof','Iris','Íris','f','parte colorida do olho','f','olho')
bil('lens','partof','Lens','Cristalino','m','lente natural do olho','f','olho')
bil('vitreous body','partof','Corpus vitreum','Corpo vítreo','m','gel que preenche o olho','m','olho')
bil('choroid','partof','Choroidea','Coroide','f','camada de vasos atrás da retina','f','olho')
bil('superior rectus','partof','Musculi externi bulbi oculi','Músculos do olho','mp','músculos que movem o olho','mp','olho',
    extras=('{s} inferior rectus','{s} medial rectus','{s} lateral rectus','{s} superior oblique','{s} inferior oblique'))
bil('lacrimal gland','partof','Glandula lacrimalis','Glândula lacrimal','f','glândula da lágrima','f','olho')

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'estruturas.csv'),'w',newline='',encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['fmaId','arvore','fmaIdsExtras','excluirFmaIds','nomeLatim','nomePt','nomeLeigo','sistema','lado','vetorExplosao','razaoSimplificacao']); w.writerows(rows)
ids = [r[0] for r in rows]; dup = {i for i in ids if ids.count(i) > 1}
print(f'{len(rows)} linhas; duplicados: {dup or "nenhum"}')
from collections import Counter; print(Counter(r[7] for r in rows))
print('MISS obrigatórios:', miss or 'nenhum'); print('extras ausentes:', avisos or 'nenhum')
