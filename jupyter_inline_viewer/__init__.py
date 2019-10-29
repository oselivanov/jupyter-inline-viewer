"""Helper functions for Jupyter inline viewer."""

__author__ = 'Oleg Selivanov <oleg.a.selivanov@gmail.com>'

import base64
import json
import time
from cStringIO import StringIO
from uuid import uuid4

from IPython.display import HTML, display
from PIL import Image, ImageDraw


VIEWER_TEMPLATE = """
<div class="jiv-container" id="jiv-container-{0}">
    Waiting for <a href="{1}"><b>Jupyter inline viewer</b></a> extension to
    load...<br>
    If it's not loading make sure you <b>have it installed</b> and
    you also <b>trust the notebook</b>.
</div>
"""

SLIDE_HTML_TEMPLATE = """
<section hidden="" aria-hidden="true" class="future"
         style="display: block; left: 19px; top: 19px; width: 960px;"
         data-index-h="" data-index-v="INDEX">
    <div class="cell border-box-sizing text_cell rendered">
        <div class="prompt input_prompt"></div>
        <div class="inner_cell">
            <div class="text_cell_render border-box-sizing rendered_html">
                <img src="SRC">
            </div>
        </div>
    </div>
</section>
"""  # noqa

SLIDE_PDF_TEMPLATE = """
<div class="pdf-page" style="height: 727px;">
    <div class="slide-background present" data-loaded="true"
         style="display: block;">
    </div>
    <section hidden="" aria-hidden="true" class="present"
             style="display: block; left: 19px; top: 19px; width: 960px;"
             data-index-h="" data-index-v="INDEX">
        <div class="cell border-box-sizing text_cell rendered">
            <div class="prompt input_prompt"></div>
            <div class="inner_cell">
                <div class="text_cell_render border-box-sizing rendered_html">
                    <img src="SRC">
                </div>
            </div>
        </div>
    </section>
</div>
"""  # noqa


SCRIPT_TEMPLATE = '''
<script>
  (function() {{
    var urls = {1};
    var params = {2};
    var slide_html_template = '{3}';
    var slide_pdf_template = '{4}';

    if (typeof(Jupyter) === 'undefined') {{
        $(document).ready(function() {{
            var pdf_mode = location.href.indexOf('print-pdf') != -1;
            console.log('DEBUG', pdf_mode);

            $('#jiv-container-{0}').hide();

            var template = pdf_mode ? slide_pdf_template : slide_html_template;
            console.log(template);
            var html = '';
            var index = 0;

            $('#jiv-slides-{0} img')
                .each(function() {{
                    html += template
                        .replace('SRC', $(this).attr('src'))
                        .replace('INDEX', index);
                    ++index;
                }});

            if (pdf_mode) {{
                $('#jiv-slides-{0}')
                    .closest('section')
                    .closest('section')
                    .replaceWith(html);
            }} else {{
                $('#jiv-slides-{0}')
                    .closest('section')
                    .replaceWith(html);
            }}
        }});
    }}

    if (typeof(Jupyter) !== 'undefined') {{
        var jivLoadingCountDown = 1;
        var jivLoadingInterval = setInterval(function() {{

          if (Jupyter.notebook.jivLoad !== undefined) {{
            clearInterval(jivLoadingInterval);
            Jupyter.notebook.jivLoad('{0}', urls, params);
          }} else {{
            --jivLoadingCountDown;
            if (jivLoadingCountDown == 0) {{
              clearInterval(jivLoadingInterval);
            }}
          }}
        }}, 500);
    }}
  }}());
</script>
'''


def show_jiv(urls, **params):
    uuid = str(uuid4())
    github_url = 'https://github.com/oselivanov/jupyter-inline-viewer'

    viewer_html = VIEWER_TEMPLATE.format(uuid, github_url)

    slides_html = ''
    slides = params.get('slides')
    if slides:
        if params.get('notes'):
            raise NotImplementedError(
                'Notes are not supported yet in generated slides.')
        if urls[0].endswith('.obj'):
            raise NotImplementedError(
                'Saving slices for .obj is not supported. '
                'Take a screenshot and attach it to cell as image instead.')

        if slides == 'all':
            url_indices = range(len(urls))

        elif hasattr(slides, '__iter__'):
            url_indices = [idx - 1 for idx in slides]

        elif isinstance(slides, int):
            n = slides
            url_indices = \
                calc_uniform_subsample_indices(urls, n)

        else:
            print 'Unsupported "slides" parameter value'
            return

        img_html_list = []

        markers = params.get('markers')
        for idx in url_indices:
            url = urls[idx]

            if markers is not None:
                im = Image.open(url)
                draw = ImageDraw.Draw(im)
                for m in markers[idx]:
                    draw.line((m[0] - 2, m[1] - 2, m[0] + 2, m[1] + 2),
                              fill=(0, 255, 255))
                    draw.line((m[0] - 2, m[1] + 2, m[0] + 2, m[1] - 2),
                              fill=(0, 255, 255))
                sio = StringIO()
                im.save(sio, format='JPEG')
                content = sio.getvalue()
            else:
                with open(url) as f:
                    content = f.read()

            encoded = base64.b64encode(content)

            uri = 'data:image/jpg;base64,{}'.format(encoded)
            img_html = '<img src="{}">'.format(uri)

            img_html_list.append(img_html)

        slides_html = (
            '<div id="jiv-slides-{0}" class=jiv-slides style="display: none">'
            '{1}</div>'
                .format(uuid, '\n'.join(img_html_list)))

        slides_html += ('{} generated sub-slide(s) saved on {}.'
            .format(len(url_indices),
                    time.strftime("%a, %d %b %Y %H:%M:%S", time.localtime())))

    script_html = SCRIPT_TEMPLATE.format(
        uuid, json.dumps(urls), json.dumps(params),
        SLIDE_HTML_TEMPLATE.replace('\n', ' '),
        SLIDE_PDF_TEMPLATE.replace('\n', ' '))

    display(HTML(viewer_html + slides_html + script_html))


def calc_uniform_subsample_indices(input_list, sublist_length):
    l = input_list  # noqa
    n = sublist_length

    if sublist_length > len(input_list):
        raise ValueError('sublist_length is too big')

    if n == 1:
        indices = [len(l) / 2]
    else:
        indices = [
            float(i) * (float(len(l) - 1) / float(n - 1)) for i in range(n)]

    indices = map(int, indices)
    indices = sorted(set(indices))

    return indices


def _jupyter_nbextension_paths():
    return [
        dict(section='notebook',
             src='static',
             dest='jupyter_inline_viewer/static',
             require='jupyter_inline_viewer/static/main')
    ]
