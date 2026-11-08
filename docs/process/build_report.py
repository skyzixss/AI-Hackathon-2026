"""Build the attributed working report; optional ReportLab and pypdf required."""
from pathlib import Path
from io import BytesIO
import html
import re
import sys
from urllib.parse import quote
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from PIL import Image as PillowImage
from pypdf import PdfReader

rl_config.useA85 = False
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'output/pdf/campus-ai-process-draft.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
font_pairs = [
    (Path('/System/Library/Fonts/Supplemental/Arial.ttf'), Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')),
    (Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')),
]
font_pair = next((pair for pair in font_pairs if all(p.exists() for p in pair)), None)
if font_pair is None:
    raise SystemExit('A Cyrillic Arial or DejaVu Sans font is required.')
pdfmetrics.registerFont(TTFont('ReportRegular', str(font_pair[0])))
pdfmetrics.registerFont(TTFont('ReportBold', str(font_pair[1])))
pdfmetrics.registerFontFamily('ReportRegular', normal='ReportRegular', bold='ReportBold', italic='ReportRegular', boldItalic='ReportBold')
BLUE = colors.HexColor('#173a60')
styles = {
    'body': ParagraphStyle('body', fontName='ReportRegular', fontSize=10.3, leading=15.5, textColor=colors.HexColor('#223047'), spaceAfter=9),
    'h1': ParagraphStyle('h1', fontName='ReportBold', fontSize=21, leading=27, textColor=BLUE, spaceAfter=18, keepWithNext=True),
    'h2': ParagraphStyle('h2', fontName='ReportBold', fontSize=15, leading=20, textColor=BLUE, spaceBefore=16, spaceAfter=10, keepWithNext=True),
    'h3': ParagraphStyle('h3', fontName='ReportBold', fontSize=12, leading=17, textColor=BLUE, spaceBefore=12, spaceAfter=8, keepWithNext=True),
    'quote': ParagraphStyle('quote', fontName='ReportRegular', fontSize=10.3, leading=15.5, textColor=BLUE, leftIndent=16, rightIndent=10, borderColor=colors.HexColor('#8abbdc'), borderWidth=.5, borderPadding=9, spaceBefore=5, spaceAfter=13),
    'caption': ParagraphStyle('caption', fontName='ReportRegular', fontSize=9, leading=13, textColor=colors.HexColor('#516174'), alignment=TA_CENTER, spaceAfter=12),
}
story = []

def normalize(text):
    return text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-')

def inline(text, source):
    text = html.escape(normalize(text))
    def link(match):
        label, url = match.groups()
        if not re.match(r'https?://', url):
            local = (source.parent / html.unescape(url).split('#')[0]).resolve()
            if not local.is_relative_to(ROOT) or not local.exists():
                raise ValueError(f'Broken source link: {source.name}: {url}')
            url = 'https://github.com/skyzixss/AI-Hackathon-2026/blob/main/' + quote(str(local.relative_to(ROOT)))
        return f'<link href="{url}" color="#175e8e"><u>{label}</u></link>'
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`([^`]+)`', r'<font color="#173a60">\1</font>', text)
    return text


def paragraph(text, source, style='body'):
    story.append(Paragraph(inline(text, source), styles[style]))


def add_image(alt, relative, source):
    path = (source.parent / relative).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f'Invalid image: {relative}')
    with PillowImage.open(path) as image:
        content = BytesIO()
        image.convert('RGB').save(content, format='PNG')
        width, height = image.size
    content.seek(0)
    scale = min(495 / width, 390 / height)
    story.append(Image(content, width=width*scale, height=height*scale))
    paragraph(alt, source, 'caption')


def add_markdown(source):
    pending = []
    table_header = None
    def flush():
        if pending:
            paragraph(' '.join(pending), source)
            pending.clear()
    for line in source.read_text().splitlines():
        if not line.strip():
            flush()
            table_header = None
            continue
        image = re.fullmatch(r'!\[([^\]]*)\]\(([^)]+)\)', line)
        if image:
            flush(); add_image(*image.groups(), source); continue
        heading = re.match(r'^(#{1,3}) (.*)', line)
        if heading:
            flush(); story.append(Paragraph(inline(heading[2], source), styles['h'+str(len(heading[1]))])); continue
        if line.startswith('> '):
            flush(); paragraph(line[2:], source, 'quote'); continue
        if line.startswith('|'):
            flush()
            cells = [c.strip() for c in line.strip('|').split('|')]
            if all(re.fullmatch(r'[-: ]+', c) for c in cells): continue
            if table_header is None:
                table_header = cells; continue
            paragraph(' - '.join(cells), source)
            continue
        if re.match(r'^[-*] ', line):
            flush(); paragraph('• '+line[2:], source); continue
        pending.append(line)
    flush()


def page_decoration(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE); canvas.rect(0, 798, 595, 44, fill=1, stroke=0)
    canvas.setFillColor(colors.white); canvas.setFont('ReportRegular', 10)
    canvas.drawString(42, 814, 'КАМПУС  /  РАЗРАБОТКА С ИИ  /  08.11.2026')
    canvas.setFillColor(BLUE); canvas.setFont('ReportRegular', 8)
    canvas.drawString(42, 25, 'Рабочий комплект. Не отправлен на конкурс.')
    canvas.drawRightString(553, 25, str(doc.page))
    canvas.restoreState()

source = ROOT/'docs/process/skyzixss.md'
paragraph('Кампус: как создавался прототип', source, 'h1')
paragraph('Рабочий отчёт процесса разработки с ИИ. Версия от 08.11.2026.', source)
paragraph('Состав: подтверждённый материал серверной области skyzixss и авторский материал интерфейсной области Artem545111 (#26). Выбранные реальные запросы, результаты, ошибки и инструменты сохранены с атрибуцией. Исходные Markdown-файлы лежат в docs/process/.', source)
paragraph('Статус: вклад агента PUPSIK359 ещё не получен, открывшаяся форма сдачи не прочитана. Поэтому этот PDF не объявляется полным конкурсным комплектом. Недостающие промпты и модели не реконструируются.', source, 'quote')
paragraph('Содержание', source, 'h2')
paragraph('1. Сервер и интеграция: проблема, архитектура, реальные поручения, проверки, инструменты и действия людей.\n2. Интерфейс: авторские запросы и результаты, итерации, ошибки, инструменты и источники иллюстраций.\n3. Визуальная история: выбранный эскиз, неудачная попытка, результат и безопасное состояние сессии.', source)
paragraph('Публичный прототип', source, 'h2')
paragraph('[Открыть работающий «Кампус»](https://student-portal-hackathon.ankajournal-cloudflare.workers.dev). Продуктовый 11f4bb7 опубликован 07.11.2026; документационные изменения не означают новый деплой. Все учебные данные вымышлены. Пароли и личные документы в отчёт не входят.', source)
paragraph('Условия подготовки', source, 'h2')
paragraph('Рабочие материалы следует дополнить реальными выдержками владельца заявок и сверить с формой после её открытия 08.11 в 19:00 МСК. Финальную отправку, согласия участников и доступ жюри подтверждают отдельно. Типографика дефисов в PDF нормализована; точное написание цитат сохранено в авторских Markdown-источниках.', source)
story.append(PageBreak())
add_markdown(source)
story.append(PageBreak())
artem = ROOT/'docs/process/artem.md'
add_markdown(artem)
story.append(PageBreak())
paragraph('Визуальная история интерфейса', source, 'h1')
paragraph('Исторические изображения из области Артёма. Это этапы разработки и локальные проверки, а не текущие облачные балансы. Ссылки и пояснения приведены в авторском разделе выше.', source)
for relative, caption in [
    ('../design/reference.webp', 'Выбранный эскиз ImageGen до реализации в React. Исходный запрос генерации не восстановлен.'),
    ('../design/comparison-r1.webp', 'Неудачная первая попытка: сравнение потребовало исправления размеров и компоновки.'),
    ('../design/comparison-final.webp', 'Итог сравнения с выбранным направлением после исправлений.'),
    ('../session-a11y/expired.png', 'Безопасное состояние при отказе refresh: локальные управляемые HTTP-ответы, не облачный отзыв JWT.'),
]:
    add_image(caption, relative, artem)
    if 'comparison-r1' in relative: story.append(PageBreak())

doc = SimpleDocTemplate(str(OUT), pagesize=(595,842), rightMargin=42, leftMargin=42, topMargin=65, bottomMargin=48, title='Кампус: процесс разработки с ИИ - рабочая версия', author='Команда Кампус; материалы skyzixss и Artem545111')
doc.build(story, onFirstPage=page_decoration, onLaterPages=page_decoration)
reader=PdfReader(OUT)
assert len(reader.pages)>=5
text='\n'.join(page.extract_text() for page in reader.pages)
assert all(term in text for term in ['Artem545111','PUPSIK359','11f4bb7','33 теста','ImageGen'])
print(f'{OUT}: {len(reader.pages)} pages')
