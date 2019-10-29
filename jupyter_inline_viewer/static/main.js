define([
    'base/js/namespace',
    'notebook/js/notebook',
    'jquery',
    '/nbextensions/jupyter_inline_viewer/static/libs/three.min.js',
    '/nbextensions/jupyter_inline_viewer/static/libs/OBJLoader.js',
    '/nbextensions/jupyter_inline_viewer/static/libs/MTLLoader.js',
    '/nbextensions/jupyter_inline_viewer/static/libs/OrbitControls.js',
], function(
    Jupyter,
    notebook,
    $,
    THREE,
    OBJLoader,
    MTLLoader,
    OrbitControls
) {
  var JIV_DEFAULT_SETTINGS = {
    bind_hl: true,
    bind_left_right: true,
    bind_append_to_a: true,
  };

  var JIV_DEFAULT_PARAMS = {
    cache: false,
    size: [640, 480],
    camera_position: [0, 0, -1],
    camera_up: [0, -1, 0],
    camera_look_at: [0, 0, 0],
  };

  class JupyterInlineViewer {

    // Viewer constructor and APIs.

    constructor(container, urls, inputParams) {
      this.container = container;
      this.urls = urls;

      this.params = {};
      $.extend(true, this.params, JIV_DEFAULT_PARAMS, inputParams);

      if (0 === $('#jupyter-inline-viewer-styles').length) {
        $('body').append(
          '<style id=jupyter-inline-viewer-styles>' +
            '.jiv-image-viewer { position: relative; }' +
            '.jiv-image-viewer > img { display: none; position: absolute; ' +
                'z-index: 1; left: 0; top: 0; margin-top: 0; }' +
            '.jiv-image-viewer > .jiv-filename {' +
                'position: absolute; z-index: 3; left: 10px; top: 10px; ' +
                'color: #fff; text-shadow: -1px -1px 0 #000, ' +
                '1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; }' +
            '.jiv-image-viewer > .jiv-notes {' +
                'position: absolute; z-index: 3; left: 10px; bottom: 10px; ' +
                'color: #fff; text-shadow: -1px -1px 0 #000, ' +
                '1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; }' +
            '.jiv-image-viewer > .jiv-notes2 {' +
                'position: absolute; visibility: hidden; }' +
            '.jiv-image-viewer > .marker-canvas {' +
                'position: absolute; z-index: 2; left: 0; top: 0; }' +
          '</style>'
        );
      }

      var $container = $(this.container);
      $container.html('');
      $container.append(
        $('<div>').attr('class', 'jiv-filename'));
      $container.append(
        $('<div>').attr('class', 'jiv-notes'));
      $container.append(
        $('<div>').attr('class', 'jiv-notes2'));

      var ext = this.urls[0].split('.').pop();

      if (ext == 'obj') {
        this.type = '3d';
        this.init3DViewer();
      } else {
        this.type = 'image';
        this.initImageViewer();
      }
      container.jiv = this;
    }

    showNext() {
      ++this.index;
      if (this.index > this.urls.length - 1) {
        this.index = this.urls.length - 1;
        return;
      }
      if (this.type == 'image') {
        this.updateImage();
      } else {
        this.updateObj();
      }
    }

    showPrevious() {
      --this.index;
      if (this.index < 0) {
        this.index = 0;
        return;
      }
      if (this.type == 'image') {
        this.updateImage();
      } else {
        this.updateObj();
      }
    }

    getCurrentUrl() {
      return this.urls[this.index];
    }

    // Image viewer.

    initImageViewer() {
      var $container = $(this.container);
      $container.append(
        $('<canvas width="' + parseInt(this.params.size[0]) + '" ' +
                  'height="' + parseInt(this.params.size[1]) + '" ' +
                  'class="marker-canvas">'));
      this.canvas = $container.find('canvas').get(0);
      this.ctx = this.canvas.getContext('2d');

      var fragment = document.createDocumentFragment();

      this.index = 0;

      var first = true;
      var outerThis = this;
      for (var i in this.urls) {
        var el = document.createElement('img');
        var url = this.urls[i];
        if (this.params.cache === false) url += '?rnd=' + Math.random();
        el.src = url;
        if (first) {
          el.onload = function(self) {
              return function() { self.updateImage(); };
          }(outerThis);
        }
        first = false;
        fragment.appendChild(el);
      }

      $(this.container)
        .addClass('jiv-image-viewer')
        .css({
          width: this.params.size[0],
          height: this.params.size[1]
        });

      this.container.appendChild(fragment);
    }

    updateImage() {
      var $images = $(this.container).find('img');
      var $image = $images.eq(this.index);
      var w = $image.get(0).width;
      var h = $image.get(0).height;
      var src = $image.attr('src');
      var r = 1.0;
      var r1 = 1.0;

      if (w > this.params.size[0]) {
        r = this.params.size[0] / w;
      }
      if (h > this.params.size[1]) {
        r1 = this.params.size[1] / h;
        if (r1 < r) r = r1;
      }
      var new_w = parseInt(w * r);
      var new_h = parseInt(h * r);

      $image.css({
        'width': new_w + 'px',
        'height': new_h + 'px',
      });
      $image.show();
      $images.not(':eq(' + this.index + ')').hide();

      $(this.container).find('> .jiv-filename').text(src);

      if (this.params.notes) {
        var text = this.params.notes[this.index];
        $(this.container).find('> .jiv-notes2').text(text);
        var html = $(this.container).find('> .jiv-notes2').html();
        console.log(html);
        $(this.container)
            .find('> .jiv-notes').html(html.replace(/\n/gi, '<br>'));
      }

      if (this.params.markers) {
        this.canvas.width = new_w;
        this.canvas.height = new_h;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'copy';
        this.ctx.fillStyle = 'transparent';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = '#00ff00';

        this.ctx.beginPath();
        for (var i in this.params.markers[this.index]) {
          var p = this.params.markers[this.index][i];
          this.ctx.moveTo(p[0] * r - 2, p[1] * r - 2);
          this.ctx.lineTo(p[0] * r + 2, p[1] * r + 2);
          this.ctx.moveTo(p[0] * r - 2, p[1] * r + 2);
          this.ctx.lineTo(p[0] * r + 2, p[1] * r - 2);
        }
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // Obj viewer.

    init3DViewer() {
      var camera, renderer, controls;
      var self = this;

      $(this.container).addClass('jiv-image-viewer');

      camera = new THREE.PerspectiveCamera(
        45, this.params.size[0] / this.params.size[1], 0.00001, 10);

      camera.position.x = this.params.camera_position[0];
      camera.position.y = this.params.camera_position[1];
      camera.position.z = this.params.camera_position[2];

      camera.up.x = this.params.camera_up[0];
      camera.up.y = this.params.camera_up[1];
      camera.up.z = this.params.camera_up[2];

      camera.lookAt({
        x: this.params.camera_look_at[0],
        y: this.params.camera_look_at[1],
        z: this.params.camera_look_at[2]
      });

      this.scene = new THREE.Scene();

      var ambientLight = new THREE.AmbientLight(0xffffff, 1);
      this.scene.add(ambientLight);
      this.scene.add(camera);

      renderer = new THREE.WebGLRenderer({alpha: true});
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(this.params.size[0], this.params.size[1]);
      this.container.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.enableZoom = true;

      function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(self.scene, camera);
      }

      animate();

      this.index = 0;
      this.updateObj();
    }

    updateObj() {
      var url = this.urls[this.index];
      var scene = this.scene;
      var self = this;

      var urlList = url.split('/');
      var objDirUrl = urlList.splice(0, urlList.length - 1).join('/') + '/';
      var modelFile = urlList[urlList.length - 1];

      $(this.container).find('> .jiv-filename').text(url);

      var onProgress = function (xhr) {
        if (xhr.lengthComputable) {
          var percentComplete = xhr.loaded / xhr.total * 100;
          // console.log(Math.round(percentComplete, 2) + '% downloaded');
        }
      };

      var onError = function (xhr) { };

      for(var i = scene.children.length - 1; i >= 0; --i){
        console.log(scene.children[i].type);
        var type = scene.children[i].type;
        if (type != 'Group' && type != 'Line') continue;
        scene.remove(scene.children[i]);
      }


      if (self.params.notes) {
        var text = self.params.notes[self.index];
        $(self.container).find('> .jiv-notes2').text(text);
        var html = $(self.container).find('> .jiv-notes2').html();
        console.log(html);
        $(self.container)
            .find('> .jiv-notes').html(html.replace(/\n/gi, '<br>'));
      }

      var objLoader = new OBJLoader();
      objLoader.setPath(objDirUrl);
      objLoader.load(modelFile, function (object) {
        var mtlLoader = new MTLLoader();
        mtlLoader.setPath(objDirUrl);
        mtlLoader.load(object.materialLibraries[0], function(materials) {
          materials.preload();
          objLoader.setMaterials(materials);
          objLoader.load(modelFile, function (object) {
            scene.add(object);

            if (self.params.markers) {
              var r = 0.005;
              var material = new THREE.LineBasicMaterial( { color: 0x00ff00 } );
              material.depthTest = false;
              for (var i in self.params.markers[self.index]) {
                var p = self.params.markers[self.index][i];

                var geometry1 = new THREE.Geometry();
                geometry1.vertices.push(
                  new THREE.Vector3(p[0] - r, p[1] - r, p[2]));
                geometry1.vertices.push(
                  new THREE.Vector3(p[0] + r, p[1] + r, p[2]));
                var line1 = new THREE.Line(geometry1, material);
                scene.add(line1);

                var geometry2 = new THREE.Geometry();
                geometry2.vertices.push(
                  new THREE.Vector3(p[0] - r, p[1] + r, p[2]));
                geometry2.vertices.push(
                  new THREE.Vector3(p[0] + r, p[1] - r, p[2]));
                var line2 = new THREE.Line(geometry2, material);
                scene.add(line2);
              }
            }
          });
        });
      }, onProgress, onError);
    }
  }

  // Jupyter notebook integration.

  notebook.Notebook.prototype.jivLoad = function(containerId, urls, inputParams) {
    var $container = $('#jiv-container-' + containerId);
    var container = $('#jiv-container-' + containerId).get(0);

    container.jiv = new JupyterInlineViewer(container, urls, inputParams);
  };

  var jivNext = function() {
    var $cell = $(Jupyter.notebook.get_selected_cell().element);
    var container = $cell.find('.jiv-container').get(0);
    if (container) container.jiv.showNext();
  };

  var jivPrevious = function() {
    var $cell = $(Jupyter.notebook.get_selected_cell().element);
    var container = $cell.find('.jiv-container').get(0);
    if (container) container.jiv.showPrevious();
  };

  var jivAppend = function() {
    var cells = Jupyter.notebook.get_cells();
    var next_cell = cells[Jupyter.notebook.get_selected_index() + 1];
    var cm = next_cell.code_mirror;

    var $cell = $(Jupyter.notebook.get_selected_cell().element);
    var container = $cell.find('.jiv-container').get(0);

    if (container) {
      var url = container.jiv.getCurrentUrl();
      cm.replaceRange('\n' + url, CodeMirror.Pos(cm.lastLine()));
    }
  };

  function load_ipython_extension() {
		return Jupyter.notebook.config.loaded
			.then(function () {
        var jivSettings = {};

				$.extend(
          true, jivSettings,
          JIV_DEFAULT_SETTINGS,
          Jupyter.notebook.config.data.jupyter_inline_viewer);

        Jupyter.keyboard_manager.actions.register(
          { help: 'Next in inline viewer',
            icon: 'fa-check',
            handler: jivNext },
          'next-in-inline-viewer',
          'jupyter-notebook');
        Jupyter.keyboard_manager.actions.register(
          { help: 'Previous in inline viewer',
            icon: 'fa-check',
            handler: jivPrevious },
          'previous-in-inline-viewer',
          'jupyter-notebook');
        Jupyter.keyboard_manager.actions.register(
          { help: 'Append current inline viewer url to the next cell',
            icon: 'fa-check',
            handler: jivAppend },
          'append-url-to-next-cell',
          'jupyter-notebook');

        var shortcuts;
        if (jivSettings.bind_left_right) {
          Jupyter.keyboard_manager.command_shortcuts.add_shortcuts({
            'left': 'jupyter-notebook:previous-in-inline-viewer',
            'right': 'jupyter-notebook:next-in-inline-viewer',
          });
        }
        if (jivSettings.bind_hl) {
          Jupyter.keyboard_manager.command_shortcuts.add_shortcuts({
            'h': 'jupyter-notebook:previous-in-inline-viewer',
            'l': 'jupyter-notebook:next-in-inline-viewer',
            'a': 'jupyter-notebook:append-url-to-next-cell',
          });
        }
        if (jivSettings.bind_append_to_a) {
          Jupyter.keyboard_manager.command_shortcuts.add_shortcuts({
            'a': 'jupyter-notebook:append-url-to-next-cell',
          });
        }
      });
  }

  return {
		load_ipython_extension : load_ipython_extension,
		load_jupyter_extension : load_ipython_extension,
  };
});
