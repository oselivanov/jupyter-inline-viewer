"""Helper functions for Jupyter inline viewer."""

__author__ = 'Oleg Selivanov <oleg.a.selivanov@gmail.com>'

import json
from uuid import uuid4

from IPython.display import HTML, display


def show_jiv(urls, **params):
    uuid = str(uuid4())
    github_url = 'https://github.com/oselivanov/jupyter-inline-viewer'

    viewer = '''
      <div class="jiv-container" id="jiv-container-{0}">
        Waiting for <b>Jupyter inline viewer</b> extension to load...<br>
        If it's not loading make sure you <b>have it installed</b> and
        you also <b>trust the notebook</b>.
      </div>

      <script>
      (function() {{
        var jivLoadingCountDown = 10;
        var jivLoadingInterval = setInterval(function() {{
          if (Jupyter.notebook.jivLoad !== undefined) {{
            clearInterval(jivLoadingInterval);
            Jupyter.notebook.jivLoad('{0}', {2}, {3});
          }} else {{
            --jivLoadingCountDown;
            if (jivLoadingCountDown == 0) {{
              clearInterval(jivLoadingInterval);
            }}
          }}
        }}, 500);

      }}());
      </script>
    '''
    # TODO: Remove this hack.
    display(HTML(
        viewer.format(uuid, github_url, json.dumps(urls), json.dumps(params))))
