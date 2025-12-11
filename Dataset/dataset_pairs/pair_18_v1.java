/*
 * Copyright 2008 Alibaba.com Croporation Limited.
 *
 */
package com.alibaba.dubbo.rpc.cluster.support;

import java.util.List;

/**
 * @author <a href="mailto:gang.lvg@alibaba-inc.com">kimi</a>
 */
public interface MenuService {

    public Menu getMenu();

    public void includeMenu(String menu, List<String> items);

}
