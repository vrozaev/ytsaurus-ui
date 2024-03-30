import React, {Component, Fragment} from 'react';
import hammer from '../../common/hammer';
import cn from 'bem-cn-lite';
import _ from 'lodash';

import {Flex} from '@gravity-ui/uikit';

import {AclMode, IdmObjectType} from '../../constants/acl';

import ColumnGroups from './ColumnGroups/ColumnGroups';

import DeletePermissionModal from './DeletePermissionModal/DeletePermissionModal';
import UserPermissions from './UserPermissions/UserPermissions';

import LoadDataHandler from '../../components/LoadDataHandler/LoadDataHandler';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import DataTableYT from '../../components/DataTableYT/DataTableYT';
import {ClipboardButton, Loader, Popover} from '@gravity-ui/uikit';
import Icon from '../../components/Icon/Icon';
import Link from '../../components/Link/Link';
import {Tooltip} from '../../components/Tooltip/Tooltip';
import {UserName} from '../../components/UserLink/UserLink';

import withVisible, {WithVisibleProps} from '../../hocs/withVisible';
import {renderText} from '../../components/templates/utils';
import Label from '../../components/Label/Label';
import {isIdmAclAvailable} from '../../config';
import ApproversFilters from './ApproversFilters/ApproversFilters';
import ObjectPermissionsFilters from './ObjectPermissionsFilters/ObjectPermissionsFilters';
import UIFactory, {AclRoleActionsType} from '../../UIFactory';

import {ACLReduxProps} from './ACL-connect-helpers';
import {PreparedAclSubject} from '../../utils/acl/acl-types';
import {PreparedApprover} from '../../store/selectors/acl';

import {Column} from '@gravity-ui/react-data-table';
import {SegmentControl, SegmentControlItem} from '../../components/SegmentControl/SegmentControl';
import {PreparedRole} from '../../utils/acl';
import {AclModeControl} from './AclModeControl';

import './ACL.scss';

const block = cn('navigation-acl');

type Props = ACLReduxProps & WithVisibleProps;

type ApproverRow = Props['approversFiltered'][number];
type PermissionsRow = Props['mainPermissions'][number];

class ACL extends Component<Props> {
    static tableColumns = {
        items: {
            inherited: {
                caption: '',
                align: 'center',
            },
            subjects: {
                align: 'left',
            },
            permissions: {
                align: 'left',
            },
            columns: {
                caption: 'Private columns',
                align: 'left',
            },
            inheritance_mode: {
                align: 'left',
            },
            actions: {
                caption: '',
                align: 'right',
            },
            responsibles: {
                align: 'left',
            },
            read_approvers: {
                align: 'left',
            },
            auditors: {
                align: 'left',
            },
            approve_type: {
                align: 'left',
                caption: 'Type',
            },
        },
        sets: {
            objectDefault: {
                items: ['inherited', 'subjects', 'permissions', 'inheritance_mode', 'actions'],
            },
            columns: {
                items: ['inherited', 'subjects', 'columns'],
            },
            approvers: {
                items: ['inherited', 'subjects', 'approve_type', 'actions'],
            },
        },
    };

    // eslint-disable-next-line react/sort-comp
    static renderSubjectLink(item: PreparedAclSubject | PreparedApprover | PermissionsRow) {
        if (item.subjectType === 'user') {
            const {subjectUrl} = item;
            const username = item.subjects[0];
            return (
                <UserName key={username} url={subjectUrl} userName={username as string}>
                    <span className={block('subject-name')}>{username}</span>
                </UserName>
            );
        }

        if (item.subjectType === 'tvm') {
            const tvmId = item.subjects[0];
            const {name} = item.tvmInfo ?? {};

            const text = `${name} (${tvmId})`;
            return (
                <div className={block('subject-column')}>
                    <Link
                        key={name}
                        className={block('subject-link')}
                        url={item.subjectUrl}
                        theme="primary"
                        title={text}
                    >
                        <span className={block('subject-name')}>{text}</span>
                    </Link>
                    <Label text="TVM" />
                </div>
            );
        }

        const {name, url, group} = item.groupInfo || {};
        return (
            <Link key={name} url={url} theme="primary">
                <Tooltip
                    content={
                        group && (
                            <React.Fragment>
                                idm-group:{group}
                                <span className={block('copy-idm-group')}>
                                    <ClipboardButton text={`idm-group:${group}`} size={16} />
                                </span>
                            </React.Fragment>
                        )
                    }
                >
                    <span className={block('subject-name')}>{name}</span>
                </Tooltip>
            </Link>
        );
    }

    state = {
        deleteItem: {} as {key?: string},
    };

    componentDidMount() {
        const {path, idmKind, loadAclData} = this.props;

        if (path) {
            loadAclData({path, idmKind});
        }
    }

    componentDidUpdate(prevProps: Props) {
        const {path, idmKind, loadAclData} = this.props;
        if (prevProps.path !== path) {
            loadAclData({path, idmKind});
        }
    }

    getColumnsTemplates<T extends ApproverRow | PermissionsRow>() {
        const openDeleteModal = this.handleDeletePermissionClick;
        const {cluster, idmKind} = this.props;
        return {
            inherited: {
                name: 'inherited',
                header: '',
                className: block('table-item', {type: 'inherited'}),
                render({row}) {
                    return (
                        row.inherited && (
                            <Popover content={'Role is inherited'}>
                                <Icon awesome="level-down-alt" />
                            </Popover>
                        )
                    );
                },
            } as Column<T>,
            subjects: {
                name: 'Subjects',
                align: 'left',
                className: block('table-item', {type: 'subjects'}),
                render({row}) {
                    const {internal} = row;
                    if (!internal) {
                        return ACL.renderSubjectLink(row);
                    }

                    const nodes = _.map(row.subjects, (subject, index) => {
                        const isGroup = row.types?.[index] === 'group';
                        const url = isGroup
                            ? `/${cluster}/groups?groupFilter=${subject}`
                            : `/${cluster}/users?filter=${subject}`;
                        return (
                            <Link key={index} theme={'primary'} routed url={url}>
                                <span className={block('subject-name')}>{subject}</span>
                            </Link>
                        );
                    });

                    if (nodes.length === 1) return nodes[0];
                    return <div className={block('subjects-list')}>{nodes}</div>;
                },
            } as Column<T>,
            permissions: {
                name: 'Permissions',
                align: 'left',
                className: block('table-item', {type: 'permissions'}),
                render({row}) {
                    const action = row.action === 'deny' ? 'deny' : 'allow';
                    const theme = action === 'deny' ? 'danger' : 'success';

                    return (
                        <div className={block('permissions', {type: row.action})}>
                            <Label className={block('action-label')} theme={theme}>
                                {action}
                            </Label>
                            {renderText(row.permissions?.map(hammer.format.Readable).join(', '))}
                        </div>
                    );
                },
            } as Column<T>,
            inheritance_mode: {
                name: 'Inheritance mode',
                render({row}) {
                    return renderText(hammer.format['ReadableField'](row.inheritance_mode));
                },
                align: 'left',
                className: block('table-item', {type: 'inheritance-mode'}),
            } as Column<T>,
            actions: {
                name: 'actions',
                header: '',
                align: 'right',
                className: block('table-item', {type: 'actions'}),
                render({row}) {
                    const RoleActions = UIFactory.getComponentForAclRoleActions();
                    return (
                        RoleActions !== undefined && (
                            <RoleActions role={row} idmKind={idmKind} onDelete={openDeleteModal} />
                        )
                    );
                },
            } as Column<T>,
            approve_type: {
                name: 'Type',
                align: 'left',
                className: block('table-item', {type: 'approve-type'}),
                render({row}) {
                    return hammer.format['Readable'](row.type);
                },
            } as Column<T>,
            columns: {
                name: 'Private columns',
                align: 'left',
                className: block('table-item', {type: 'columns'}),
                render({row}) {
                    return renderText(row.columns?.map((column) => `"${column}"`).join(', '));
                },
            } as Column<T>,
        };
    }

    handleDeletePermissionClick = (deleteItem: AclRoleActionsType) => {
        const {handleShow} = this.props;
        this.setState({deleteItem}, handleShow);
    };

    handleCloseDeleteModal = () => {
        const {handleClose} = this.props;
        this.setState({deleteItem: {}}, handleClose);
    };

    rowClassNameByFlags<T extends ApproverRow | PermissionsRow>(item: T) {
        const {
            isUnrecognized: unrecognized,
            isDepriving: depriving,
            isRequested: requested,
            isApproved: approved,
            isMissing: missing,
        } = item;
        return block('row', {
            unrecognized: unrecognized || missing,
            depriving,
            requested,
            approved,
        });
    }

    renderApprovers() {
        const {hasApprovers, approversFiltered} = this.props;
        const tableColumns = (['inherited', 'subjects', 'approve_type', 'actions'] as const).map(
            (name) => this.getColumnsTemplates<ApproverRow>()[name],
        );
        return (
            hasApprovers && (
                <ErrorBoundary>
                    <div className={block('approvers')}>
                        <div className="elements-heading elements-heading_size_xs">
                            Responsibles
                        </div>
                        <ApproversFilters />
                        <DataTableYT
                            data={approversFiltered}
                            columns={tableColumns}
                            theme={'yt-borderless'}
                            rowClassName={this.rowClassNameByFlags}
                            settings={{
                                sortable: false,
                                displayIndices: false,
                            }}
                        />
                    </div>
                </ErrorBoundary>
            )
        );
    }

    renderObjectPermissions() {
        const {
            aclMode,
            mainPermissions,
            columnsPermissions,
            idmKind,
            columnsFilter,
            updateAclFilters,
            userPermissionsAccessColumns,
        } = this.props;
        const useColumns = aclMode === AclMode.COLUMN_GROUPS_PERMISSISONS;
        const extraColumns = useColumns ? ['columns' as const] : [];

        const tableColumns: Array<Column<PermissionsRow>> = (
            [
                'inherited',
                'subjects',
                'permissions',
                ...extraColumns,
                'inheritance_mode',
                'actions',
            ] as const
        ).map((name) => this.getColumnsTemplates<PermissionsRow>()[name]);

        const data = useColumns ? columnsPermissions : mainPermissions;

        return (
            <ErrorBoundary>
                <div className={block('object-permissions')}>
                    <div className="elements-heading elements-heading_size_xs">
                        {useColumns ? 'Private columns permissions' : 'Object permissions'}
                    </div>
                    <ObjectPermissionsFilters
                        {...{
                            aclMode,
                            idmKind,
                            columnsFilter,
                            updateAclFilters,
                            userPermissionsAccessColumns,
                        }}
                    />

                    <DataTableYT
                        data={data}
                        columns={tableColumns}
                        theme={'yt-borderless'}
                        rowClassName={this.rowClassNameByFlags}
                        settings={{
                            sortable: false,
                            displayIndices: false,
                        }}
                    />
                </div>
            </ErrorBoundary>
        );
    }

    renderColumnGroups() {
        const {
            columnGroups,
            idmKind,
            path,
            loadAclData,
            cluster,
            nodeType,
            updateAclFilters,
            columnsFilter,
            columnGroupNameFilter,
            userPermissionsAccessColumns,
        } = this.props;
        const props = {
            path,
            loadAclDataFn: () => loadAclData({path, idmKind}),
            columnGroups,
            cluster,
            allowEdit: nodeType === 'map_node',
            updateAclFilters,
            columnsFilter,
            columnGroupNameFilter,
            userPermissionsAccessColumns,
        };
        return isIdmAclAvailable() && idmKind === IdmObjectType.PATH ? (
            <ColumnGroups {...props} />
        ) : null;
    }

    deletePermissionsFn = async (...args: Parameters<Props['deletePermissionsFn']>) => {
        const {deletePermissionsFn, loadAclData, idmKind, path} = this.props;
        const res = await deletePermissionsFn(...args);
        await loadAclData({path, idmKind});
        return res;
    };

    renderContent() {
        const {
            disableAclInheritance,
            visible,
            bossApproval,
            disableInheritanceResponsible,
            path,
            idmKind,
            version,
            userPermissions,
            userPermissionsRequestError,
            userPermissionsAccessColumns,
            userPermissionsRequestFn,
            userPermissionsCancelRequestFn,
            isPermissionDeleted,
            deletePermissionsLastItemKey,
            deletePermissionsError,
            loadAclData,
            loading,
            loaded,
            error,
            errorData,
            auditors,
            readApprovers,
            responsible,
            userPermissionsUpdateAcl,
            userPermissionsUpdateAclError,
            userPermissionsCancelUpdateAcl,
            cluster,
            columnGroups,
            aclMode,
            updateAclFilters,
        } = this.props;
        const {deleteItem} = this.state;

        const useColumns = aclMode && aclMode === AclMode.COLUMN_GROUPS_PERMISSISONS;

        return (
            <Fragment>
                {Boolean(aclMode) && (
                    <div>
                        <AclModeControl {...{aclMode, updateAclFilters}} />
                    </div>
                )}
                {this.renderFlags()}
                {useColumns ? this.renderColumnGroups() : this.renderApprovers()}
                {this.renderObjectPermissions()}

                {loaded && (
                    <UserPermissions
                        cluster={cluster}
                        className={block('user-permissions')}
                        path={path}
                        idmKind={idmKind}
                        version={version}
                        accessColumns={userPermissionsAccessColumns}
                        permissions={userPermissions}
                        requestPermissions={userPermissionsRequestFn}
                        requestPermissionsError={userPermissionsRequestError}
                        cancelRequestPermissions={userPermissionsCancelRequestFn}
                        loadAclData={loadAclData}
                        loading={loading}
                        loaded={loaded}
                        error={error}
                        errorData={errorData}
                        inheritAcl={!disableAclInheritance}
                        bossApproval={bossApproval}
                        disableInheritanceResponsible={disableInheritanceResponsible}
                        auditors={auditors}
                        readApprovers={readApprovers}
                        responsible={responsible}
                        updateAcl={userPermissionsUpdateAcl}
                        updateAclError={userPermissionsUpdateAclError}
                        cancelUpdateAcl={userPermissionsCancelUpdateAcl}
                        columnGroups={columnGroups}
                        aclMode={aclMode}
                    />
                )}
                <DeletePermissionModal
                    idmKind={idmKind}
                    path={path}
                    key={deleteItem?.key}
                    visible={visible}
                    itemToDelete={deleteItem}
                    handleClose={this.handleCloseDeleteModal}
                    isPermissionDeleted={isPermissionDeleted}
                    lastItemKey={deletePermissionsLastItemKey}
                    deletePermissions={this.deletePermissionsFn}
                    error={deletePermissionsError}
                />
            </Fragment>
        );
    }

    renderFlags() {
        const {idmKind, disableAclInheritance, bossApproval, disableInheritanceResponsible} =
            this.props;
        const {allowBossApprovals, allowInheritAcl, allowInheritResponsibles} =
            UIFactory.getAclPermissionsSettings()[idmKind];

        function toSegmentItem(name: string, role?: boolean | PreparedRole, invert?: boolean) {
            return {
                name,
                value: invert ? !role : Boolean(role),
                url: 'boolean' === typeof role ? 'https://yt.yandex-team.ru' : role?.idmLink,
            };
        }

        const segments: Array<SegmentControlItem> = _.compact([
            allowInheritAcl && toSegmentItem('Inherit ACL', disableAclInheritance, true),
            isIdmAclAvailable() &&
                allowBossApprovals &&
                toSegmentItem('Boss approval', bossApproval),
            isIdmAclAvailable() &&
                allowInheritResponsibles &&
                toSegmentItem('Inherit responsibles', disableInheritanceResponsible, true),
        ]);

        const {mainPermissions, columnsPermissions, approversFiltered, columnGroups, aclMode} =
            this.props;

        const counters: Array<SegmentControlItem> =
            aclMode === AclMode.COLUMN_GROUPS_PERMISSISONS
                ? [
                      {name: 'Column groups', value: columnGroups.length},
                      {name: 'Column permissions', value: columnsPermissions.length},
                  ]
                : [
                      {name: 'Responsibles', value: approversFiltered.length},
                      {name: 'Object permissions', value: mainPermissions.length},
                  ];

        return (
            <Flex className={block('meta')} wrap>
                <SegmentControl
                    className={block('meta-overview')}
                    background="neutral-light"
                    groups={[segments, counters]}
                />
            </Flex>
        );
    }

    render() {
        const {loading, loaded} = this.props;
        const initialLoading = loading && !loaded;

        return (
            <ErrorBoundary>
                <LoadDataHandler {...this.props}>
                    <div className={block({loading: initialLoading})}>
                        {initialLoading ? <Loader /> : this.renderContent()}
                    </div>
                </LoadDataHandler>
            </ErrorBoundary>
        );
    }
}

export default withVisible(ACL);
