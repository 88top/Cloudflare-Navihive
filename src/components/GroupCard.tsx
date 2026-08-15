import React, { useState, useEffect } from 'react';
import { Site, Group } from '../API/http';
import SiteCard from './SiteCard';
import { GroupWithSites } from '../types';
import EditGroupDialog from './EditGroupDialog';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
// 引入Material UI组件
import {
  Paper,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Collapse,
} from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// 更新组件属性接口
interface GroupCardProps {
  group: GroupWithSites;
  index?: number; // 用于Draggable的索引，仅在分组排序模式下需要
  sortMode: 'None' | 'GroupSort' | 'SiteSort';
  currentSortingGroupId: number | null;
  viewMode?: 'readonly' | 'edit'; // 访问模式
  onUpdate: (updatedSite: Site) => void;
  onDelete: (siteId: number) => void;
  onSaveSiteOrder: (groupId: number, sites: Site[]) => void;
  onStartSiteSort: (groupId: number) => void;
  onAddSite?: (groupId: number) => void; // 新增添加卡片的可选回调函数
  onUpdateGroup?: (group: Group) => void; // 更新分组的回调函数
  onDeleteGroup?: (groupId: number) => void; // 删除分组的回调函数
  configs?: Record<string, string>; // 传入配置
  // ★ 新增：跨组拖拽相关，用于判断/高亮"当前是否有站点正悬停在本分组标题栏上"
  dragOverGroupId?: number | null;
  isOverGroupHeader?: boolean;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  sortMode,
  currentSortingGroupId,
  viewMode = 'edit', // 默认为编辑模式
  onUpdate,
  onDelete,
  onSaveSiteOrder,
  onStartSiteSort,
  onAddSite,
  onUpdateGroup,
  onDeleteGroup,
  configs,
  dragOverGroupId = null,
  isOverGroupHeader = false,
}) => {
  // 添加编辑弹窗的状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // 添加提示消息状态
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  // 添加折叠状态
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem(`group-${group.id}-collapsed`);
    return savedState ? JSON.parse(savedState) : false;
  });

  // 保存折叠状态到本地存储
  useEffect(() => {
    if (group.id) {
      localStorage.setItem(`group-${group.id}-collapsed`, JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, group.id]);

  // 判断是否为当前正在编辑（排序）的分组
  const isCurrentEditingGroup = sortMode === 'SiteSort' && currentSortingGroupId === group.id;

  // ★ 新增：站点排序期间，非当前排序分组强制折叠，作为跨组拖拽的"目标容器"
  const forceCollapsedForSiteSort = sortMode === 'SiteSort' && !isCurrentEditingGroup;
  const effectiveCollapsed = forceCollapsedForSiteSort ? true : isCollapsed;

  // 处理折叠切换（排序期间，非当前分组禁止手动展开，保持折叠）
  const handleToggleCollapse = () => {
    if (forceCollapsedForSiteSort) return;
    setIsCollapsed(!isCollapsed);
  };

  // ★ 新增：把分组标题栏注册为可放置区域（dnd-kit droppable）
  // 只有在站点排序模式下才启用，id 格式必须和 App.tsx 里 handleDragOver/handleDragEnd
  // 判断的 'group-header-' 前缀完全一致，否则 over.id 永远匹配不上
  const { setNodeRef: setHeaderDroppableRef, isOver: isHeaderDropOver } = useDroppable({
    id: `group-header-${group.id}`,
    disabled: sortMode !== 'SiteSort',
  });

  // ★ 新增：综合 dnd-kit 自身的 isOver 与父组件传入的状态，双重判断更稳妥
  const isHeaderHighlighted =
    sortMode === 'SiteSort' &&
    (isHeaderDropOver || (dragOverGroupId === group.id && isOverGroupHeader));

  // 编辑分组处理函数
  const handleEditClick = () => {
    setEditDialogOpen(true);
  };

  // 更新分组处理函数
  const handleUpdateGroup = (updatedGroup: Group) => {
    if (onUpdateGroup) {
      onUpdateGroup(updatedGroup);
      setEditDialogOpen(false);
    }
  };

  // 删除分组处理函数
  const handleDeleteGroup = (groupId: number) => {
    if (onDeleteGroup) {
      onDeleteGroup(groupId);
      setEditDialogOpen(false);
    }
  };

  // 渲染站点卡片区域
  const renderSites = () => {
    // 非当前排序分组，在站点排序模式下不渲染站点内容（只作为拖拽目标显示标题栏）
    if (!isCurrentEditingGroup && sortMode === 'SiteSort') {
      return null;
    }

    const sitesToRender = group.sites;

    // 当前排序分组：可组内拖拽排序
    // 注意：这里不再包裹 <DndContext>，而是直接依赖 App.tsx 顶层的 DndContext，
    // 这样同一次拖拽操作，App.tsx 的 onDragStart/onDragOver/onDragEnd 才能收到事件，
    // 从而实现"组内排序 + 跨组转移"共用同一套拖拽状态
    if (isCurrentEditingGroup) {
      return (
        <SortableContext
          items={sitesToRender.map((site) => `site-${site.id}`)}
          strategy={horizontalListSortingStrategy}
        >
          <Box sx={{ width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                margin: -1,
              }}
            >
              {sitesToRender.map((site, idx) => (
                <Box
                  key={site.id || idx}
                  sx={{
                    width: {
                      xs: '50%',
                      sm: '50%',
                      md: '25%',
                      lg: '25%',
                      xl: '25%',
                    },
                    padding: 1,
                    boxSizing: 'border-box',
                  }}
                >
                  <SiteCard
                    site={site}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    isEditMode={true}
                    viewMode={viewMode}
                    index={idx}
                    iconApi={configs?.['site.iconApi']}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </SortableContext>
      );
    }

    // 普通模式下的渲染
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          margin: -1,
        }}
      >
        {sitesToRender.map((site) => (
          <Box
            key={site.id}
            sx={{
              width: {
                xs: '100%',
                sm: '50%',
                md: '33.33%',
                lg: '25%',
                xl: '20%',
              },
              padding: 1,
              boxSizing: 'border-box',
            }}
          >
            <SiteCard
              site={site}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isEditMode={false}
              viewMode={viewMode}
              iconApi={configs?.['site.iconApi']}
            />
          </Box>
        ))}
      </Box>
    );
  };

  // 保存站点排序（手动点击"保存顺序"按钮时的兜底动作）
  const handleSaveSiteOrder = () => {
    if (!group.id) {
      console.error('分组 ID 不存在,无法保存排序');
      return;
    }
    onSaveSiteOrder(group.id, group.sites);
  };

  // 处理排序按钮点击
  const handleSortClick = () => {
    if (!group.id) {
      console.error('分组 ID 不存在,无法开始排序');
      return;
    }
    if (group.sites.length < 2) {
      setSnackbarMessage('至少需要2个站点才能进行排序');
      setSnackbarOpen(true);
      return;
    }
    // 确保分组展开
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    onStartSiteSort(group.id);
  };

  // 关闭提示消息
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Paper
      elevation={sortMode === 'None' ? 2 : 3}
      sx={{
        borderRadius: 4,
        p: { xs: 2, sm: 3 },
        transition: 'all 0.3s ease-in-out',
        border: '1px solid transparent',
        '&:hover': {
          boxShadow: sortMode === 'None' ? 6 : 3,
          borderColor: 'divider',
          transform: sortMode === 'None' ? 'scale(1.01)' : 'none',
        },
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(33, 33, 33, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <Box
        ref={setHeaderDroppableRef}
        display='flex'
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={2.5}
        gap={1}
        sx={{
          borderRadius: 2,
          transition: 'all 0.25s ease-in-out',
          // ★ 新增：标题栏高亮样式，跨组拖拽悬停时生效
          ...(isHeaderHighlighted && {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.25)' : 'rgba(25, 118, 210, 0.1)',
            boxShadow: '0 0 0 2px #1976d2 inset',
            transform: 'scale(1.01)',
          }),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: forceCollapsedForSiteSort ? 'default' : 'pointer',
            '&:hover': {
              '& .collapse-icon': {
                color: forceCollapsedForSiteSort ? 'inherit' : 'primary.main',
              },
            },
          }}
          onClick={handleToggleCollapse}
        >
          <IconButton
            size='small'
            className='collapse-icon'
            disabled={forceCollapsedForSiteSort}
            sx={{
              transform: effectiveCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            <ExpandMoreIcon />
          </IconButton>
          <Typography
            variant='h5'
            component='h2'
            fontWeight='600'
            color='text.primary'
            sx={{ mb: { xs: 1, sm: 0 } }}
          >
            {group.name}
            <Typography component='span' variant='body2' color='text.secondary' sx={{ ml: 1 }}>
              ({group.sites.length})
            </Typography>
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', sm: 'row' },
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
            flexWrap: 'wrap',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}
        >
          {isCurrentEditingGroup ? (
            <Button
              variant='contained'
              color='primary'
              size='small'
              startIcon={<SaveIcon />}
              onClick={handleSaveSiteOrder}
              sx={{
                minWidth: 'auto',
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
              }}
            >
              保存顺序
            </Button>
          ) : (
            sortMode === 'None' &&
            viewMode === 'edit' && (
              <>
                {onAddSite && group.id && (
                  <Button
                    variant='contained'
                    color='primary'
                    size='small'
                    onClick={() => onAddSite(group.id)}
                    startIcon={<AddIcon />}
                    sx={{
                      minWidth: 'auto',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    添加卡片
                  </Button>
                )}
                <Button
                  variant='outlined'
                  color='primary'
                  size='small'
                  startIcon={<SortIcon />}
                  onClick={handleSortClick}
                  sx={{
                    minWidth: 'auto',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  }}
                >
                  排序
                </Button>

                {onUpdateGroup && onDeleteGroup && (
                  <Tooltip title='编辑分组'>
                    <IconButton
                      color='primary'
                      onClick={handleEditClick}
                      size='small'
                      sx={{ alignSelf: 'center' }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )
          )}
        </Box>
      </Box>

      <Collapse in={!effectiveCollapsed} timeout='auto'>
        {renderSites()}
      </Collapse>

      {onUpdateGroup && onDeleteGroup && (
        <EditGroupDialog
          open={editDialogOpen}
          group={group}
          onClose={() => setEditDialogOpen(false)}
          onSave={handleUpdateGroup}
          onDelete={handleDeleteGroup}
        />
      )}

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity='info' sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default GroupCard;
