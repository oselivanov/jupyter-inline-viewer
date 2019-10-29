"""Package Setup."""

__author__ = 'Oleg Selivanov'

from setuptools import find_packages, setup

setup(
    name='jupyter-inline-viewer',
    version='0.2.0',
    packages=find_packages(),
    include_package_data=True,
    setup_requires=['pytest-runner'],
    tests_require=['pytest'],
    description='Jupyter inline viewer',
    long_description='',
    # license=__copyright__,
    url='https://github.com/oselivanov/jupyter-inline-viewer',
    author=__author__,
    author_email='oleg.a.selivanov@gmail.com',
    classifiers=[
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 2',
        'Programming Language :: Python :: 2.7',
    ],
)
